import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';
import {
  ResourceManagementClient,
  ResourceManagementModels,
} from '@azure/arm-resources';
import {credential} from '../test/azure';
import {AzureIdentityCredentialAdapter} from './azure';
import _ = require('lodash');

export type Rule = ResourceGraphRule | DummyRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | DummyTarget | ARMTarget;

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
  ARM = 'ARM',
  Dummy = 'Dummy',
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
  execute?: (target: T) => Promise<ScanResult>;
}

export interface ResourceGraphTarget {
  type: RuleType.ResourceGraph;
  subscriptionIds: string[];
  credential: DefaultAzureCredential;
  groupNames?: string[];
}

export interface ARMTarget {
  type: RuleType.ARM;
  subscriptionId: string;
  groupNames?: string[];
}

export interface DummyTarget {
  type: RuleType.Dummy;
  context: object;
}

export class DummyRule implements BaseRule<DummyTarget> {
  type: RuleType.Dummy;
  name: string;
  description: string;
  context: object;

  constructor(rule: {
    type: RuleType.Dummy;
    name: string;
    description: string;
    context: object;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.context = rule.context;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_: DummyTarget) {
    return Promise.resolve({
      ruleName: this.name,
      description: this.description,
      total: 0,
      resourceIds: [],
    }) as Promise<ScanResult>;
  }
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

type ARMOperator =
  | 'shouldEqual'
  | 'shouldNotEqual'
  | 'includes'
  | 'notIncludes';

interface ARMEvaluationObject {
  operator: ARMOperator;
  value: string;
  nextPathRef?: string;
}

interface ARMEvaluation {
  id: number;
  resourceType: string;
  path: string[];
  evaluate: ARMEvaluationObject;
  and?: ARMEvaluation;
  or?: ARMEvaluation;
}

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  name: string;
  description: string;
  evaluations: ARMEvaluation[];

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    evaluations: ARMEvaluation[];
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluations = rule.evaluations;
  }

  static async getTemplate(client: ResourceManagementClient) {
    return client.resourceGroups.exportTemplate('aza-1614638848251', {
      resources: ['*'],
      options: 'SkipAllParameterization',
    }) as Promise<
      ResourceManagementModels.ResourceGroupsExportTemplateResponse & {
        resources: ARMResource[];
      }
    >;
  }

  async execute(target: ARMTarget) {
    let results: string[] = [];
    const resourceClient = new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(credential),
      target.subscriptionId
    );
    const template = await ARMTemplateRule.getTemplate(resourceClient);
    const resources = template._response.parsedBody.template.resources;
    for (const e of this.evaluations) {
      results = [...results, ...this.evaluate(e, resources)];
    }
    return this.toScanResult(results);
  }

  toScanResult(resourceNames: string[]): ScanResult {
    const scanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceNames.length,
      resourceIds: resourceNames,
    };
    return scanResult;
  }

  evaluate(e: ARMEvaluation, resources: ARMResource[], prevPath?: string) {
    let result: string[] = [];
    const filteredResources = resources.filter(r => r.type === e.resourceType);
    const resourceNames = filteredResources.map(r => {
      let passing = true;
      let expectedValue;
      const actualValue = _.get(r, e.path);
      if (prevPath === 'id') {
        expectedValue = this.getResourceIdFromFunction(r);
      } else if (Array.isArray(prevPath)) {
        expectedValue = _.get(r, prevPath);
      } else {
        expectedValue = e.evaluate.value;
      }
      switch (e.evaluate.operator) {
        case 'shouldEqual':
          if (actualValue !== expectedValue) {
            passing = false;
          }
          break;
        case 'shouldNotEqual':
          if (actualValue === expectedValue) {
            passing = false;
          }
          break;
        case 'includes':
          if (!actualValue.includes(expectedValue)) {
            passing = false;
          }
          break;
        case 'notIncludes':
          if (actualValue.includes(expectedValue)) {
            passing = false;
          }
          break;
        default:
          break;
      }
      if (e.and && !passing) {
        result = [
          ...result,
          ...this.evaluate(e.and, resources, e.evaluate.nextPathRef),
        ];
      }
      if (e.or && passing) {
        if (e.or.resourceType === e.resourceType) {
          this.evaluate(e.or, filteredResources, e.or.evaluate.nextPathRef);
        } else {
          this.evaluate(e.or, filteredResources, e.or.evaluate.nextPathRef);
        }
      }
      return r.name;
    });
    result = [...result, ...resourceNames];
    return result;
  }

  getResourceIdFromFunction(resource: ARMResource) {
    return resource.name;
  }

  getResourcesByType(type: string, resources: ARMResource[]) {
    return resources.filter(r => r.type === type);
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
