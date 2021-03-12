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

interface BaseRule {
  name: string;
  description: string;
  type: RuleType;
}

export interface ResourceGraphRule extends BaseRule {
  type: RuleType.ResourceGraph;
  query: string;
}

export interface ResourceGraphTarget {
  type: RuleType.ResourceGraph;
  subscriptionId: string;
}

export interface DummyTarget {
  type: RuleType.Dummy;
  context: object;
}

export interface DummyRule extends BaseRule {
  type: RuleType.Dummy;
  context: object;
}

export class DummyRuleExecutor {
  static execute(rules: DummyRule[]) {
    const results = rules.map(r => {
      return Promise.resolve({
        ruleName: r.name,
        description: r.description,
        total: 0,
        resourceIds: [],
      }) as Promise<ScanResult>;
    });
    return Promise.all(results);
  }
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphExecutor {
  static async execute(
    rules: ResourceGraphRule[],
    target: ResourceGraphTarget
  ) {
    const credential = new DefaultAzureCredential();
    const client = new AzureClient(credential);
    const results = rules.map(async r => {
      const resources = await client.queryResources(r.query, [
        target.subscriptionId,
      ]);
      return this.toScanResult(resources, r);
    });
    return Promise.all(results);
  }

  static toScanResult(
    response: ResourceGraphModels.ResourcesResponse,
    rule: ResourceGraphRule
  ): ScanResult {
    const cols = response.data.columns as ResourceGraphQueryResponseColumn[];
    const rows = response.data.rows as string[];
    const idIndex = cols.findIndex(c => c.name === 'id');
    if (idIndex === -1) {
      throw new Error('Id column was not returned from Azure Resource Graph');
    }
    const resourceIds = rows.map(r => r[idIndex]);
    const scanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: response.totalRecords,
      resourceIds,
    };
    return scanResult;
  }
}
