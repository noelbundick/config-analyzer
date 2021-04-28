import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {ResourceManagementClient} from '@azure/arm-resources';
import {DefaultAzureCredential, TokenCredential} from '@azure/identity';
import JMESPath = require('jmespath');

import {
  BaseRule,
  RuleType,
  Evaluation,
  isRequestEvaluation,
  HttpMethods,
  filterAsync,
} from '.';
import {AzureClient, AzureIdentityCredentialAdapter} from '../azure';
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
    // after first evaluation runs, evaluate the request evalution if it exists
    resourceIds = await filterAsync(resourceIds, async resourceId => {
      if (isRequestEvaluation(this.evaluation)) {
        const response = await this.sendRequest(target, resourceId);
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

  async sendRequest(target: ResourceGraphTarget, resourceId: string) {
    if (!isRequestEvaluation(this.evaluation)) {
      throw Error('A valid request evalutation was not found');
    }
    const token = await target.credential.getToken(
      'https://graph.microsoft.com/.default'
    );
    const resourceManagementClient = await this.getResourceManagmentClient(
      resourceId
    );
    const options = {
      url: await this.getRequestUrl(resourceId, resourceManagementClient),
      method: this.evaluation.request.httpMethod as HttpMethods,
      headers: {
        Authorization: `Bearer ${token?.token}`,
        'Content-Type': 'application/json',
      },
    };
    let response = await resourceManagementClient.sendRequest(options);
    // if the response returns an error because the default api verison is invalid, then parse the error message to retrieve a valid one and try again
    if (
      response.status === 400 &&
      response.parsedBody.error.code === 'NoRegisteredProviderFound'
    ) {
      const apiVersion = this.getApiVersionFromError(
        response.parsedBody.error.message
      );
      options.url = await this.getRequestUrl(
        resourceId,
        resourceManagementClient,
        apiVersion
      );
      response = await resourceManagementClient.sendRequest(options);
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
    // splits message so the initial api version that failed is not included in the regex match.
    const splitMessage = errorMessage.split('The supported api-versions are ');
    const versions = splitMessage[1];
    const regExps = [
      new RegExp(/\d\d\d\d-\d\d-\d\d-preview/g),
      new RegExp(/\d\d\d\d-\d\d-\d\d/g),
    ];
    for (const r of regExps) {
      // first looks for any preview api versions, then looks for latest if preview is not found.
      const apiVersions = versions.match(r);
      if (apiVersions) {
        return apiVersions[apiVersions.length - 1];
      }
    }
    throw Error('Unable to find a valid api version');
  }

  async getDefaultApiVersion(
    resourceId: string,
    client: ResourceManagementClient
  ) {
    const provider = this.getElementFromId('provider', resourceId);
    const resourceType = this.getElementFromId('resourceType', resourceId);
    const providerResponse = await client.providers.get(provider);
    const apiVersion = providerResponse.resourceTypes?.find(
      r => r.resourceType === resourceType
    )?.defaultApiVersion;
    if (apiVersion) {
      return apiVersion;
    }
    throw Error('unable to retrieve a valid api version');
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
      apiVersion = await this.getDefaultApiVersion(resourceId, client);
    }
    if (isRequestEvaluation(this.evaluation)) {
      return `https://management.azure.com/${resourceId}/${this.evaluation.request.operation}?api-version=${apiVersion}`;
    }
    throw Error('The request evaluation was not provided');
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
