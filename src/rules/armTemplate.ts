import {ResourceManagementClient} from '@azure/arm-resources';
import {DefaultAzureCredential, TokenCredential} from '@azure/identity';
import JMESPath = require('jmespath');
import Handlebars = require('handlebars');

import {BaseRule, RuleType} from '.';
import {AzureIdentityCredentialAdapter} from '../azure';
import {ScanResult} from '../scanner';
import {HttpMethods} from '@azure/core-rest-pipeline';

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
}

// All evaluations contain a JMESPath query that operate on ARM resources
type BaseEvaluation = {
  query: string;
  // request?: {
  //   type: string;
  //   apiVersion: string;
  //   query: string;
  // };
};

// Some evaluations may check for additional conditions
type AndEvaluation = BaseEvaluation & {
  and: Array<Evaluation>;
};

type RequestEvaluation = BaseEvaluation & {
  request: {
    type: string;
    apiVersion: string;
    query: string;
  };
};

function isAndEvaluation(evaluation: Evaluation): evaluation is AndEvaluation {
  return (evaluation as AndEvaluation).and !== undefined;
}

function isRequestEvaluation(
  evaluation: Evaluation
): evaluation is RequestEvaluation {
  return (evaluation as RequestEvaluation).request !== undefined;
}

function mapAsync<T1, T2>(
  array: T1[],
  callback: (value: T1, index: number, array: T1[]) => Promise<T2>
): Promise<T2[]> {
  return Promise.all(array.map(callback));
}

async function filterAsync<T>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
  const filterMap = await mapAsync(array, callback);
  return array.filter((_, index) => filterMap[index]);
}

// Evaluations may be standalone or composite
type Evaluation = BaseEvaluation | AndEvaluation | RequestEvaluation;

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  name: string;
  description: string;
  evaluation: Evaluation;

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    evaluation: Evaluation;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
  }

  static async getTemplate(
    subscriptionId: string,
    groupName: string,
    credential: TokenCredential
  ) {
    const client = new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(credential),
      subscriptionId
    );
    return await client.resourceGroups.exportTemplate(groupName, {
      resources: ['*'],
      options: 'SkipAllParameterization',
    });
  }

  async execute(target: ARMTarget) {
    let results = this.evaluate(this.evaluation, target.template);
    const evaluation = this.evaluation;
    if (results.length > 0 && isRequestEvaluation(evaluation)) {
      results = await filterAsync(results, async resource => {
        const query = evaluation.request.query;
        const response = await this.sendRequest(evaluation, resource);
        return JMESPath.search(response, query);
      });
    }
    const resourceIds = results.map(r => this.getResourceId(r, target));
    return Promise.resolve(this.toScanResult(resourceIds));
  }

  toScanResult(resourceIds: string[]): ScanResult {
    const scanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceIds.length,
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
    target: ARMTemplate,
    parent?: ARMResource
  ): Array<ARMResource> {
    const query = this.render(evaluation.query, parent);
    const resources = JMESPath.search(
      target.resources,
      query
    ) as Array<ARMResource>;

    // If we found resources with the initial query, filter those down to the ones that meet all the criteria
    if (resources.length > 0 && isAndEvaluation(evaluation)) {
      // TODO: make this readable
      return resources.filter(resource =>
        evaluation.and.every(r => this.evaluate(r, target, resource).length > 0)
      );
    }

    return resources;
  }

  async sendRequest(evaluation: RequestEvaluation, resource: ARMResource) {
    const subscriptionId = '6c1f4f3b-f65f-4667-8f9e-b9c48e09cd6b';
    const resourceGroup = 'josh-function-tutorial';
    const requestType = evaluation.request?.type || '';
    const requestApiVersion = evaluation.request?.apiVersion || '';
    const credential = new DefaultAzureCredential();
    const client = new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(credential),
      subscriptionId
    );
    const token = await credential.getToken(
      'https://graph.microsoft.com/.default'
    );
    const options = {
      url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${resource.type}/${resource.name}/${requestType}?api-version=${requestApiVersion}`,
      method: 'POST' as HttpMethods,
      headers: {
        Authorization: `Bearer ${token?.token}`,
        'Content-Type': 'application/json',
        Host: 'management.azure.com',
      },
    };
    return await client.sendRequest(options);
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
