import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';

export type Rule = IResourceGraphRule | IDummyRule;

interface BaseRule {
  name: string;
  description: string;
  type: string;
}

export interface IResourceGraphRule extends BaseRule {
  type: 'resourceGraph';
  query: string;
}

export interface IDummyRule extends BaseRule {
  type: 'dummy';
  context: object;
}

export class DummyRule {
  static execute(rules: IDummyRule[]) {
    const results = rules.map(r => {
      return Promise.resolve({
        ruleName: r.name,
        description: r.description,
        total: 0,
        ids: [],
      }) as Promise<ScanResult>;
    });
    return Promise.all(results);
  }
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphRule {
  static async execute(rules: IResourceGraphRule[], subscriptionId: string) {
    const credential = new DefaultAzureCredential();
    const client = new AzureClient(credential);
    const results = rules.map(async r => {
      const resources = await client.queryResources(r.query, [subscriptionId]);
      return this._toScanResult(resources, r);
    });
    return Promise.all(results);
  }

  private static _toScanResult(
    response: ResourceGraphModels.ResourcesResponse,
    rule: IResourceGraphRule
  ): ScanResult {
    const cols = response.data.columns as ResourceGraphQueryResponseColumn[];
    const rows = response.data.rows as string[];
    const idIndex = cols.findIndex(c => c.name === 'id');
    const resourceIds = rows.map(r => r[idIndex]);
    const scanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: response.totalRecords,
      ids: resourceIds,
    };
    return scanResult;
  }
}
