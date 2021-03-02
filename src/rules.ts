import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {DefaultAzureCredential} from '@azure/identity';
import {AzureClient} from './azure';
import {RuleSchema, ScanResult} from './scanner';

export type Rule = ResourceGraphRule;

interface Execute {
  execute(): Promise<ScanResult>;
}

interface ResourceGraphQueryResponseColumn {
  name: string;
  type: string | object;
}

export class ResourceGraphRule implements Execute {
  static type: 'resourceGraph';
  name: string;
  description: string;
  query: string;
  subscriptionId: string;

  constructor(rule: RuleSchema, subscriptionId: string) {
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

  private toScanResult(response: ResourceGraphModels.ResourcesResponse) {
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
