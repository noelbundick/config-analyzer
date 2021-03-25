import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';

export type Rule = ResourceGraphRule | DummyRule;
export type Target = ResourceGraphTarget | DummyTarget;

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
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

  static async getNonExisitingResourceGroups(target: ResourceGraphTarget) {
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
