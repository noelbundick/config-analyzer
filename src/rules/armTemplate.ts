import {ResourceManagementClient} from '@azure/arm-resources';
import {TokenCredential} from '@azure/identity';
import JMESPath = require('jmespath');
import Handlebars = require('handlebars');

import {BaseRule, RuleType} from '.';
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
}

// All evaluations contain a JMESPath query that operate on ARM resources
type BaseEvaluation = {
  query: string;
};

// Some evaluations may check for additional conditions
type AndEvaluation = BaseEvaluation & {
  and: Array<Evaluation>;
};

function isAndEvaluation(evaluation: Evaluation): evaluation is AndEvaluation {
  return (evaluation as AndEvaluation).and !== undefined;
}

// Evaluations may be standalone or composite
type Evaluation = BaseEvaluation | AndEvaluation;

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  name: string;
  description: string;
  evaluation: Evaluation;
  recommendation?: string;

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    evaluation: Evaluation;
    recommendation?: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
    this.recommendation = rule.recommendation;
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

  execute(target: ARMTarget) {
    const results = this.evaluate(this.evaluation, target.template);
    const resourceIds = results.map(r => this.getResourceId(r, target));
    return Promise.resolve(this.toScanResult(resourceIds));
  }

  toScanResult(resourceIds: string[]): ScanResult {
    const scanResult: ScanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceIds.length,
      resourceIds: resourceIds,
    };
    if (this.recommendation) {
      scanResult.recommendation = this.recommendation;
    }
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
