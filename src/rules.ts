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

interface IResourceGraphRule extends BaseRule {
  type: 'resourceGraph';
  query: string;
}

interface IDummyRule extends BaseRule {
  type: 'dummy';
  context: object;
}

export class DummyRule {
  static execute(rule: IDummyRule): Promise<ScanResult> {
    return Promise.resolve({
      ruleName: rule.name,
      description: rule.description,
      total: 0,
      ids: [],
    });
  }
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphRule {
  static async execute(rule: IResourceGraphRule, subscriptionId: string) {
    const credential = new DefaultAzureCredential();
    const client = new AzureClient(credential);
    const resources = await client.queryResources(rule.query, [subscriptionId]);
    return this._toScanResult(resources, rule);
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
