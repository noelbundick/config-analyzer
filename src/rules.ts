import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {ScanResult} from './scanner';

export type Rule = IResourceGraphRule | IDummyRule;

export type RuleContext = ResourceGraphRuleContext | DummyRuleContext;

interface ResourceGraphRuleContext {
  type: 'resourceGraph';
  rules: IResourceGraphRule[];
}

interface DummyRuleContext {
  type: 'dummy';
  rules: IDummyRule[];
}

interface BaseRule {
  name: string;
  description: string;
}

interface IResourceGraphRule extends BaseRule {
  query: string;
}

interface IDummyRule extends BaseRule {
  context: object;
}

export class DummyRule {
  static execute(rules: IDummyRule[]) {
    const results = rules.map(r => {
      return Promise.resolve({
        ruleName: r.name,
        description: r.description,
        total: 0,
        resources: [],
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
      resources: resourceIds.map(id => {
        return {id};
      }),
    };
    return scanResult;
  }
}
