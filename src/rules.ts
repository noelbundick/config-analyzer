import { ResourcesResponse } from "@azure/arm-resourcegraph/esm/models";
import { DefaultAzureCredential } from "@azure/identity";
import { AzureClient } from "./azure"

export interface Rule {
  name: string;
  description: string;
  resourceGraph?: ResourceGraphQuery;
}

export interface ResourceGraphQuery {
  query: string;
}

export interface RuleExecutor {
  execute(): Promise<ScanResult>;
}

export interface ScanResult {
    ruleName: string;
    total: number;
    ids: string[];
}

interface QueryResponseColumn {
    name: string;
    type: string | object; 
}

export class ResourceGraphRule implements RuleExecutor {
    name: string;
    query: string;
    subscriptionId: string;

    constructor(name: string, queryObj: ResourceGraphQuery, subscriptionId: string){
        this.name = name;
        this.query = queryObj.query;
        this.subscriptionId = subscriptionId;
    }

    execute(){
        const credential = new DefaultAzureCredential();
        const client = new AzureClient(credential);
        const resources = client.queryResources(this.query, [this.subscriptionId]) 
        return resources.then(r => this.toScanResult(r))
    }

    private toScanResult(response: ResourcesResponse){
        const cols = response.data.columns as QueryResponseColumn[]
        const rows = response.data.rows as []
        const idIndex = cols.findIndex(c => c.name === 'id') 
        const resourceIds = rows.map(r => r[idIndex]) 
        const scanResult = {ruleName: this.name, total: response.totalRecords, ids: resourceIds}
        return scanResult 
    }
}