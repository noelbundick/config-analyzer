import {ResourceManagementClient} from '@azure/arm-resources';
import {TokenCredential} from '@azure/identity';
import JMESPath = require('jmespath');
import Handlebars = require('handlebars');

import {
  BaseRule,
  RuleType,
  Evaluation,
  RequestEvaluation,
  isRequestEvaluation,
  isAndEvaluation,
  HttpMethods,
  filterAsync,
} from '.';
import {AzureIdentityCredentialAdapter} from '../azure';
import {ScanResult} from '../scanner';

export interface ARMTemplate {
  $schema: string;
  contentVersion: string;
  parameters: {};
  variables: {};
  resources: ARMResource[];
}

export interface ARMResource {
  apiVersion: string;
  name: string;
  type: string;
}

export interface ARMTarget {
  type: RuleType.ARM;
  template: ARMTemplate;
  subscriptionId: string;
  groupName: string;
  credential: TokenCredential;
  client: ResourceManagementClient;
}

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  name: string;
  description: string;
  evaluation: Evaluation;
  recommendation: string;

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    evaluation: Evaluation;
    recommendation: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
    this.recommendation = rule.recommendation;
  }

  static async getTarget(
    subscriptionId: string,
    groupName: string,
    credential: TokenCredential
  ): Promise<ARMTarget> {
    const client = new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(credential),
      subscriptionId
    );
    const template = await client.resourceGroups.exportTemplate(groupName, {
      resources: ['*'],
      options: 'SkipAllParameterization',
    });
    return {
      subscriptionId,
      groupName,
      credential,
      client,
      template: template._response.parsedBody.template,
      type: RuleType.ARM,
    };
  }

  async execute(target: ARMTarget) {
    let results = this.evaluate(this.evaluation, target.template);
    // if we found resources from the first evaluations, filter those down to the ones that meet all the criteria for the request evaluation
    // if it is not a request evaluation then no-op just return true
    results = await filterAsync(results, async resource => {
      if (isRequestEvaluation(this.evaluation)) {
        const response = await this.sendRequest(
          target,
          resource,
          this.evaluation
        );
        return JMESPath.search(
          response.parsedBody,
          this.evaluation.request.query
        );
      } else {
        return true;
      }
    });

    const resourceIds = results.map(r => this.getResourceId(r, target));
    return Promise.resolve(this.toScanResult(resourceIds));
  }

  toScanResult(resourceIds: string[]): ScanResult {
    const scanResult: ScanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceIds.length,
      recommendation: this.recommendation,
      resourceIds: resourceIds,
    };
    return scanResult;
  }

  render(query: string, parent?: ARMResource): string {
    let text = query;

    if (parent) {
      const template = Handlebars.compile(text);
      text = template({parent});
    }

    return `[?${text}]`;
  }

  evaluate(
    evaluation: Evaluation,
    template: ARMTemplate,
    parent?: ARMResource
  ): Array<ARMResource> {
    const query = this.render(evaluation.query, parent);
    const resources = JMESPath.search(
      template.resources,
      query
    ) as Array<ARMResource>;

    // If we found resources with the initial query, filter those down to the ones that meet all the criteria
    if (resources.length > 0 && isAndEvaluation(evaluation)) {
      return resources.filter(resource =>
        evaluation.and.every(
          r => this.evaluate(r, template, resource).length > 0
        )
      );
    }

    return resources;
  }

  async sendRequest(
    target: ARMTarget,
    resource: ARMResource,
    evaluation: RequestEvaluation
  ) {
    if (!isRequestEvaluation(this.evaluation)) {
      throw Error('A valid request evalutation was not found');
    }
    const token = await target.credential.getToken(
      'https://graph.microsoft.com/.default'
    );
    const options = {
      url: this.getRequestUrl(target, resource, evaluation),
      method: this.evaluation.request.httpMethod as HttpMethods,
      headers: {
        Authorization: `Bearer ${token?.token}`,
        'Content-Type': 'application/json',
      },
    };
    return await target.client.sendRequest(options);
  }

  getRequestUrl(
    target: ARMTarget,
    resource: ARMResource,
    evaluation: RequestEvaluation
  ) {
    return `https://management.azure.com/subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${resource.type}/${resource.name}/${evaluation.request.operation}?api-version=${resource.apiVersion}`;
  }

  toResourceIdARMFunction(resource: ARMResource) {
    let path;
    // needs logic to convert ARM functions
    // https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/template-functions
    if (this.isARMFunction(resource.name)) {
      // this currently only removes the array []
      path = resource.name.slice(1, resource.name.length - 1);
    } else {
      path = resource.name
        .split('/')
        .map(el => `'${el}'`)
        .join(', ');
    }
    return `[resourceId('${resource.type}', ${path})]`;
  }

  isARMFunction(value: string) {
    return value[0] === '[' && value[value.length - 1] === ']';
  }

  getResourceId(resource: ARMResource, target: ARMTarget) {
    return `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${resource.type}/${resource.name}`;
  }
}
