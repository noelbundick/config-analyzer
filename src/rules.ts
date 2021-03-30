import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';
import {ResourceManagementClient} from '@azure/arm-resources';
import {credential} from '../test/azure';
import {AzureIdentityCredentialAdapter} from './azure';
import {ARMResource, EventHubNetworkRuleSet} from './index2';
import _ = require('lodash');

export type Rule = ResourceGraphRule | DummyRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | DummyTarget | ARMTarget;

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
  ARM = 'ARM',
  Dummy = 'Dummy',
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

export class ARMTemplateRule implements BaseRule<ARMTarget> {
  type: RuleType.ARM;
  resourceType: string;
  name: string;
  description: string;
  allMustPass: boolean;
  evaluations: {
    path: string;
    invalid: string | number;
  }[];

  constructor(rule: {
    type: RuleType.ARM;
    name: string;
    description: string;
    resourceType: string;
    allMustPass: boolean;
    evaluations: {
      path: string;
      invalid: string | number;
    }[];
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluations = rule.evaluations;
    this.resourceType = rule.resourceType;
    this.allMustPass = rule.allMustPass;
  }

  async execute(target: ARMTarget) {
    const resourceClient = new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(credential),
      target.subscriptionId
    );
    const response = await resourceClient.resourceGroups.exportTemplate(
      'josh-trash',
      {resources: ['*']}
    );

    const networkRuleSets = response.template.resources.filter(
      (r: ARMResource) => r.type === this.resourceType
    ) as ARMResource[];

    let passing = true;
    console.log(response.template.resources);
    const resources = networkRuleSets.map((r: ARMResource) => {
      this.evaluations.forEach(e => {
        const res = _.get(r, e.path);
        if (res === e.invalid) {
          if (this.allMustPass) passing = false;
          passing = false;
        }
      });
      return r.name;
    });
    console.log(resources);

    return passing ? this.toScanResult([]) : this.toScanResult(resources);
  }

  toScanResult(resourceIds: string[]): ScanResult {
    const scanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceIds.length,
      resourceIds,
    };
    return scanResult;
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
