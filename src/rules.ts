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
  subscriptionId: string;
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
  static credential = new DefaultAzureCredential();
  static client = new AzureClient(ResourceGraphRule.credential);

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
    const response = await ResourceGraphRule.client.queryResources(this.query, [
      target.subscriptionId,
    ]);
    return this.toScanResult(response);
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
