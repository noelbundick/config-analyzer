import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {ResourceManagementClient} from '@azure/arm-resources';
import {DefaultAzureCredential, TokenCredential} from '@azure/identity';
import {
  BaseRule,
  RuleType,
  Evaluation,
  isRequestEvaluation,
  HttpMethods,
} from '.';
import {AzureClient, AzureIdentityCredentialAdapter} from '../azure';
import {ScanResult} from '../scanner';
import {filterAsync} from './armTemplate';
import JMESPath = require('jmespath');

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
  evaluation: Evaluation;
  recommendation: string;

  constructor(rule: {
    type: RuleType.ResourceGraph;
    name: string;
    description: string;
    evaluation: Evaluation;
    recommendation: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
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
        this.evaluation.query,
        target.subscriptionIds
      );
    }

    let resourceIds = this.convertResourcesResponseToIds(response);

    resourceIds = await filterAsync(resourceIds, async resourceId => {
      if (isRequestEvaluation(this.evaluation)) {
        const response = await this.sendRequest(target, resourceId);
        console.log(response);
        return JMESPath.search(
          response.parsedBody,
          this.evaluation.request.query
        );
      } else {
        return true;
      }
    });
    return this.toScanResult(resourceIds);
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
    const firstPipeIndex = this.evaluation.query.indexOf('|');
    if (firstPipeIndex === -1) {
      // while it is a Microsoft recommendation to start Resource Graph queries with the table name,
      // for this application it is a requirement in order to support filtering for resource groups in the query
      throw Error("Invalid Query. All queries must start with '<tableName> |'");
    } else {
      const initalTable = this.evaluation.query.slice(0, firstPipeIndex - 1);
      const queryEnding = this.evaluation.query.slice(firstPipeIndex);
      return `${initalTable} ${groupQuery} ${queryEnding}`;
    }
  }

  async sendRequest(
    target: ResourceGraphTarget,
    resourceId: string,
    apiVersion?: string
  ) {
    const token = await target.credential.getToken(
      'https://graph.microsoft.com/.default'
    );
    const resourceManagementClient = await this.getResourceManagmentClient(
      resourceId
    );

    const options = {
      url: await this.getRequestUrl(
        resourceId,
        resourceManagementClient,
        apiVersion
      ),
      method: HttpMethods.GET,
      headers: {
        Authorization: `Bearer ${token?.token}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await resourceManagementClient.sendRequest(options);
    if (
      response.status === 400 &&
      response.parsedBody.error.code === 'NoRegisteredProviderFound'
    ) {
      if (apiVersion) {
        throw Error('Something went wrong');
      }
      apiVersion = this.getApiVersionFromError(
        response.parsedBody.error.message
      );
      return await this.sendRequest(target, resourceId, apiVersion);
    }
    return response;
  }

  async getResourceManagmentClient(resourceId: string) {
    const subscriptionId = this.getElementFromId('subscription', resourceId);
    return await new ResourceManagementClient(
      new AzureIdentityCredentialAdapter(new DefaultAzureCredential()),
      subscriptionId
    );
  }

  getApiVersionFromError(errorMessage: string) {
    let apiVersion;
    const splitMessage = errorMessage.split('The supported api-versions are ');
    const versions = splitMessage[1];
    const regExps = [
      new RegExp(/\d\d\d\d-\d\d-\d\d-preview/),
      new RegExp(/\d\d\d\d-\d\d-\d\d/),
    ];

    function match(regex: RegExp) {
      const match = versions.match(regex);
      if (match) {
        return match[0];
      } else {
        return null;
      }
    }

    for (const r of regExps) {
      apiVersion = match(r);
      if (apiVersion) {
        return apiVersion;
      }
    }
    throw Error('Unable to find a valid apiVersion');
  }
  async getApiVersion(resourceId: string, client: ResourceManagementClient) {
    const provider = this.getElementFromId('provider', resourceId);
    const resourceType = this.getElementFromId('resourceType', resourceId);
    const providers = await client.providers.get(provider);
    const apiVersions = providers.resourceTypes?.find(
      r => r.resourceType === resourceType
    )?.apiVersions;
    if (apiVersions) {
      return apiVersions[0];
    }
    throw Error('unable to retrieve a valid Api Version');
  }

  getElementFromId(
    element: 'subscription' | 'provider' | 'resourceType',
    resourceId: string
  ) {
    const splitId = resourceId.split('/');
    switch (element) {
      case 'subscription': {
        const subscriptionsIdx =
          splitId.findIndex(el => el === 'subscriptions') + 1;
        return splitId[subscriptionsIdx];
      }
      case 'provider': {
        const providerNamespaceIdx =
          splitId.findIndex(el => el === 'providers') + 1;
        return splitId[providerNamespaceIdx];
      }
      case 'resourceType': {
        const resourceTypeIdx = splitId.findIndex(el => el === 'providers') + 2;
        return splitId[resourceTypeIdx];
      }
    }
  }

  async getRequestUrl(
    resourceId: string,
    client: ResourceManagementClient,
    apiVersion?: string
  ) {
    if (!apiVersion) {
      apiVersion = await this.getApiVersion(resourceId, client);
    }
    if (isRequestEvaluation(this.evaluation)) {
      return `https://management.azure.com/${resourceId}/${this.evaluation.request.operation}?api-version=${apiVersion}`;
    }
    // update error message
    throw Error('There was a problem with the request');
  }

  convertResourcesResponseToIds(
    response: ResourceGraphModels.ResourcesResponse
  ) {
    const cols = response.data.columns as ResourceGraphQueryResponseColumn[];
    const rows = response.data.rows as string[];
    const idIndex = cols.findIndex(c => c.name === 'id');
    if (idIndex === -1) {
      throw new Error('Id column was not returned from Azure Resource Graph');
    }
    const resourceIds = rows.map(r => r[idIndex]);
    return resourceIds;
  }

  toScanResult(resourceIds: string[]): ScanResult {
    const scanResult: ScanResult = {
      ruleName: this.name,
      description: this.description,
      total: resourceIds.length,
      recommendation: this.recommendation,
      resourceIds,
    };
    return scanResult;
  }
}
