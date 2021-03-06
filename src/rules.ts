import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';

export type RuleContext = ResourceGraphRuleContext | DummyRuleContext;

interface BaseRuleContext {
  type: string;
  rules: Rule[];
}

interface ResourceGraphRuleContext extends BaseRuleContext {
  type: 'resourceGraph';
  rules: IResourceGraphRule[];
  subscriptionId: string;
}

interface DummyRuleContext extends BaseRuleContext {
  type: 'dummy';
  rules: IDummyRule[];
  target: object;
}

interface Rule {
  name: string;
  description: string;
}

interface IResourceGraphRule extends Rule {
  query: string;
}

interface IDummyRule extends Rule {
  context: object;
}

export class DummyRule {
  static async execute(context: DummyRuleContext) {
    const results = context.rules.map(async r => {
      const result: Promise<ScanResult> = Promise.resolve({
        ruleName: r.name,
        description: r.description,
        total: 0,
        resources: [],
      });
      return result;
    });
    return Promise.all(results);
  }
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphRule {
  static async execute(context: ResourceGraphRuleContext) {
    const credential = new DefaultAzureCredential();
    const client = new AzureClient(credential);
    const results = context.rules.map(async r => {
      const resources = await client.queryResources(r.query, [
        context.subscriptionId,
      ]);
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
      resources: resourceIds.map(id => {
        return {id};
      }),
    };
    return scanResult;
  }
}
