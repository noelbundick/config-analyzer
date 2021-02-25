import {ResourcesResponse} from '@azure/arm-resourcegraph/esm/models';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';

export type Rule = ResourceGraphRule;

export interface IRule {
  name: string;
  description: string;
  type: string;
}

interface IExecute {
  execute(): Promise<ScanResult>;
}

export interface IResourceGraphRule extends IRule {
  type: 'resourceGraph';
  query: string;
}

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  ids: string[];
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphRule implements IResourceGraphRule, IExecute {
  type: 'resourceGraph';
  name: string;
  description: string;
  query: string;
  subscriptionId: string;

  constructor(rule: IResourceGraphRule, subscriptionId: string) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.query = rule.query;
    this.subscriptionId = subscriptionId;
  }

  async execute() {
    const credential = new DefaultAzureCredential();
    const client = new AzureClient(credential);
    const resources = await client.queryResources(this.query, [
      this.subscriptionId,
    ]);
    return this.toScanResult(resources);
  }

  private toScanResult(response: ResourcesResponse) {
    const cols = response.data.columns as ResourceGraphQueryResponseColumn[];
    const rows = response.data.rows as string[];
    const idIndex = cols.findIndex(c => c.name === 'id');
    const resourceIds = rows.map(r => r[idIndex]);
    const scanResult = {
      ruleName: this.name,
      description: this.description,
      total: response.totalRecords,
      ids: resourceIds,
    };
    return scanResult;
  }
}
