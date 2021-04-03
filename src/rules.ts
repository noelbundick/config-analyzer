import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';
import {ResourceManagementClient} from '@azure/arm-resources';
import {AzureIdentityCredentialAdapter} from './azure';
import _ = require('lodash');

export type Rule = ResourceGraphRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | ARMTarget;

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
  ARM = 'ARM',
}

export interface ARMResource {
  apiVersion: string;
  name: string;
  type: string;
}

export interface BaseRule<T> {
  name: string;
  description: string;
  type: RuleType;
  execute?: (target: T) => Promise<ScanResult> | ScanResult;
}

export interface ResourceGraphTarget {
  type: RuleType.ResourceGraph;
  subscriptionIds: string[];
  credential: DefaultAzureCredential;
  groupNames?: string[];
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export interface ARMTarget {
  type: RuleType.ARM;
  templateResources: ARMResource[];
  subscriptionId?: string;
  groupName?: string;
}

export type Operator = '==' | '!=' | 'in' | 'notIn';

export interface ARMEvaluation {
  resourceType: string;
  path: string[];
  operator: Operator;
  value?: string | number;
  parentPath?: string[];
  and?: ARMEvaluation[];
  or?: ARMEvaluation[];
}

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  name: string;
  description: string;
  evaluation: ARMEvaluation;

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    evaluation: ARMEvaluation;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
  }

  static async getTemplate(subscriptionId: string, groupName: string) {
    const credential = new DefaultAzureCredential();
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
    const results = this.evaluate(this.evaluation, target, []);
    return this.toScanResult(results);
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

  evaluate(
    evaluation: ARMEvaluation,
    target: ARMTarget,
    results: string[],
    prev?: {
      resource: ARMResource;
      evaluation: ARMEvaluation;
      filteredResource?: ARMResource[] | null;
    }
  ) {
    let filteredResources: ARMResource[];
    if (prev?.filteredResource) {
      filteredResources = prev?.filteredResource;
    } else {
      filteredResources = target.templateResources.filter(
        (r: ARMResource) => r.type === evaluation.resourceType
      );
    }
    for (const r of filteredResources) {
      let passing = true;
      const actualValue = this.resolveResourcePath(r, evaluation.path);
      const expectedValue = this.getValue(evaluation, prev?.resource);
      switch (evaluation.operator) {
        case '==':
          if (actualValue !== expectedValue) {
            results.push(this.getResourceId(r, target));
            passing = false;
          }
          break;
        case '!=':
          if (actualValue === expectedValue) {
            results.push(this.getResourceId(r, target));
            passing = false;
          }
          break;
        case 'in':
          if (!actualValue.includes(expectedValue)) {
            results.push(this.getResourceId(r, target));
            passing = false;
          }
          break;
        case 'notIn':
          if (actualValue.includes(expectedValue)) {
            results.push(this.getResourceId(r, target));
            passing = false;
          }
          break;
        default:
          throw Error(
            "Invalid operator. The accepted operators are '!=', '==', 'in', 'notIn'"
          );
      }

      const next = {
        resource: r,
        evaluation,
        filteredResources: null as ARMResource[] | null,
      };
      if (passing) results = [];
      if (evaluation.and && !passing) {
        for (const e of evaluation.and) {
          if (evaluation.resourceType === e.resourceType) {
            next.filteredResources = filteredResources;
          }
          results = this.evaluate(e, target, results, next);
        }
      }
      if (evaluation.or && passing) {
        for (const e of evaluation.or) {
          if (evaluation.resourceType === e.resourceType) {
            next.filteredResources = filteredResources;
          }
          this.evaluate(e, target, results, next);
        }
      }
    }
    return results;
  }

  getValue(
    evaluation: ARMEvaluation,
    resource?: ARMResource
  ): string | number | string[] {
    if (evaluation.value || evaluation.value === 0) {
      return evaluation.value;
    } else if (resource && evaluation.parentPath) {
      if (evaluation.parentPath[0] === 'id') {
        return this.toResourceIdARMFunction(resource);
      } else {
        return this.resolveResourcePath(resource, evaluation.parentPath);
      }
    } else {
      throw Error(
        'Neither a value or a parentPath could be resolved. Every evalution needs either a value and parentPath to evaluate'
      );
    }
  }

  resolveResourcePath(resource: ARMResource, path: string[]) {
    const value = _.get(resource, path, 'NOT FOUND');
    if (value === 'NOT FOUND') {
      throw Error(
        `The path '${path.join('.')}' was not resolved on the resource ${
          resource.type
        }/${resource.name}`
      );
    }
    return value;
  }

  toResourceIdARMFunction(resource: ARMResource) {
    let path;
    if (this.isARMFunction(resource.name)) {
      // needs logic to convert arm functions
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
    if (target.subscriptionId && target.groupName) {
      return `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${resource.type}/${resource.name}`;
    } else {
      // add function to convert parameterized names to a value?
      return resource.name;
    }
  }
}

export class ResourceGraphRule implements BaseRule<ResourceGraphTarget> {
  type: RuleType.ResourceGraph;
  name: string;
  description: string;
  query: string;

  constructor(rule: {
    type: RuleType.ResourceGraph;
    name: string;
    description: string;
    query: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.query = rule.query;
  }

  async execute(target: ResourceGraphTarget) {
    const client = new AzureClient(target.credential);
    let response;
    if (target.groupNames) {
      const modifiedQuery = this.getQueryByGroups(target.groupNames);
      response = await client.queryResources(
        modifiedQuery,
        target.subscriptionIds
      );
    } else {
      response = await client.queryResources(
        this.query,
        target.subscriptionIds
      );
    }
    return this.toScanResult(response);
  }

  static async getNonExistingResourceGroups(target: ResourceGraphTarget) {
    const nonExistingGroups: string[] = [];
    if (target.groupNames) {
      const client = new AzureClient(target.credential);
      const query =
        "ResourceContainers | where type =~ 'microsoft.resources/subscriptions/resourcegroups' | project name";
      const response = await client.queryResources(query, [
        target.subscriptionIds[0],
      ]);
      const existingGroupNames = response.data.rows.flat() as string[];
      for (const g of target.groupNames) {
        if (!existingGroupNames.includes(g)) {
          nonExistingGroups.push(g);
        }
      }
    }
    return nonExistingGroups;
  }

  getQueryByGroups(groupNames: string[]) {
    const formattedGroups = groupNames.map(name => `'${name}'`).join(', ');
    const groupQuery = `| where resourceGroup in~ (${formattedGroups})`;
    const firstPipeIndex = this.query.indexOf('|');
    if (firstPipeIndex === -1) {
      // while it is a Microsoft recommendation to start Resource Graph queries with the table name,
      // for this application it is a requirement in order to support filtering for resource groups in the query
      throw Error("Invalid Query. All queries must start with '<tableName> |'");
    } else {
      const initalTable = this.query.slice(0, firstPipeIndex - 1);
      const queryEnding = this.query.slice(firstPipeIndex);
      return `${initalTable} ${groupQuery} ${queryEnding}`;
    }
  }

  toScanResult(response: ResourceGraphModels.ResourcesResponse): ScanResult {
    const cols = response.data.columns as ResourceGraphQueryResponseColumn[];
    const rows = response.data.rows as string[];
    const idIndex = cols.findIndex(c => c.name === 'id');
    if (idIndex === -1) {
      throw new Error('Id column was not returned from Azure Resource Graph');
    }
    const resourceIds = rows.map(r => r[idIndex]);
    const scanResult = {
      ruleName: this.name,
      description: this.description,
      total: response.totalRecords,
      resourceIds,
    };
    return scanResult;
  }
}
