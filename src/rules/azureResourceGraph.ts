import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {TokenCredential} from '@azure/identity';
import {BaseRule, RuleType} from '.';
import {AzureClient} from '../azure';
import {ScanResult} from '../scanner';

export interface ResourceGraphTarget {
  type: RuleType.ResourceGraph;
  subscriptionIds: string[];
  credential: TokenCredential;
  groupNames?: string[];
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
  recommendation?: string;

  constructor(rule: {
    type: RuleType.ResourceGraph;
    name: string;
    description: string;
    query: string;
    recommendation?: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.query = rule.query;
    this.recommendation = rule.recommendation;
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
    const scanResult: ScanResult = {
      ruleName: this.name,
      description: this.description,
      total: response.totalRecords,
      resourceIds,
    };
    if (this.recommendation) {
      scanResult.recommendation = this.recommendation;
    }
    return scanResult;
  }
}
