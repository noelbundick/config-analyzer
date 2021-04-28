import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {HttpHeadersLike, WebResourceLike} from '@azure/ms-rest-js';
import {expect} from 'chai';

import {ResourceGraphRule, RuleType} from '../../../src/rules';

describe('Resource Graph Rule', () => {
  const mockResourcesResponse = (): ResourceGraphModels.ResourcesResponse => {
    return {
      totalRecords: 1,
      count: 1,
      resultTruncated: 'false',
      data: {
        columns: [{name: 'id', type: 'string'}],
        rows: [['mockResourceId']],
      },
      _response: {
        request: {} as WebResourceLike,
        status: 200,
        headers: {} as HttpHeadersLike,
        bodyAsText: '',
        parsedBody: {} as ResourceGraphModels.QueryResponse,
      },
    };
  };
  const rule = new ResourceGraphRule({
    name: 'test-rule',
    evaluation: {
      query: 'mock query',
    },
    recommendation: 'recommendationLink',
    description: 'Intentional bad query',
    type: RuleType.ResourceGraph,
  });
  it('can produce a scan result', () => {
    const resourceIds = rule.convertResourcesResponseToIds(
      mockResourcesResponse()
    );
    const scanResult = rule.toScanResult(resourceIds);
    expect(scanResult).to.deep.equal({
      ruleName: rule.name,
      description: rule.description,
      total: 1,
      recommendation: rule.recommendation,
      resourceIds: ['mockResourceId'],
    });
  });
  it("should throw an errow if the 'id' column is not returned from Resource Graph", () => {
    const resourcesResponse = mockResourcesResponse();
    resourcesResponse.data.columns = [];
    const iThrowError = () =>
      rule.convertResourcesResponseToIds(resourcesResponse);
    expect(iThrowError).to.throw(
      Error,
      'Id column was not returned from Azure Resource Graph'
    );
  });
  it('can modify a query to target resource groups', () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      evaluation: {
        query: "Resources | where type =~ 'Microsoft.Network/virtualNetworks'",
      },
      recommendation: 'recommendationLink',
      description: 'Intentional bad query',
      type: RuleType.ResourceGraph,
    });
    const groupNames = ['group1', 'group2', 'group3'];
    const modifiedQuery = rule.getQueryByGroups(groupNames);
    const expectedQuery =
      "Resources | where resourceGroup in~ ('group1', 'group2', 'group3') | where type =~ 'Microsoft.Network/virtualNetworks'";
    expect(modifiedQuery).to.equal(expectedQuery);
  });
  it('should throw an error when modfiying an invalid query', () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      evaluation: {
        query: "where type =~ 'Microsoft.Network/virtualNetworks'",
      },
      recommendation: 'recommendationLink',
      description: 'Does not include the inital table name',
      type: RuleType.ResourceGraph,
    });
    const groupNames = ['group1', 'group2'];
    expect(() => rule.getQueryByGroups(groupNames)).to.throw(
      "Invalid Query. All queries must start with '<tableName> |'"
    );
  });

  it('throws an error when it cannot retrive a valid api version', async () => {
    const errorMessage =
      "No registered resource provider found for location 'eastus2' and API version '2020-02-01' for type 'namespaces'. The supported api-versions are ', , , ,'. The supported locations are 'australiaeast, australiasoutheast, centralus, eastus, eastus2, westus, westus2, northcentralus, southcentralus, westcentralus, eastasia, southeastasia, brazilsouth, japaneast, japanwest, northeurope, westeurope, centralindia, southindia, westindia, canadacentral, canadaeast, ukwest, uksouth, koreacentral, koreasouth, francecentral, southafricanorth, uaenorth, australiacentral, switzerlandnorth, germanywestcentral, norwayeast, jioindiawest'.";
    const iThrowError = () => rule.getApiVersionFromError(errorMessage);
    expect(iThrowError).throw(Error, 'Unable to find a valid api version');
  });

  it('can get a valid api version from a HttpOperationResponse error response', async () => {
    const errorMessage =
      "No registered resource provider found for location 'eastus2' and API version '2014-08-01' for type 'namespaces'. The supported api-versions are '2014-09-01, 2015-08-01, 2017-04-01, 2018-01-01-preview, 2021-01-01-preview'. The supported locations are 'australiaeast, australiasoutheast, centralus, eastus, eastus2, westus, westus2, northcentralus, southcentralus, westcentralus, eastasia, southeastasia, brazilsouth, japaneast, japanwest, northeurope, westeurope, centralindia, southindia, westindia, canadacentral, canadaeast, ukwest, uksouth, koreacentral, koreasouth, francecentral, southafricanorth, uaenorth, australiacentral, switzerlandnorth, germanywestcentral, norwayeast, jioindiawest'.";
    const apiVersions = rule.getApiVersionFromError(errorMessage);
    expect(apiVersions).to.equal('2021-01-01-preview');
  });

  it('can get the provider, subscription id, and resource type From a resource id', () => {
    const testSubId = '0000-000-000-000';
    const testResourceGroup = 'aza-demo';
    const resourceId = `subscriptions/${testSubId}/resourceGroups/${testResourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const subscription = rule.getElementFromId('subscription', resourceId);
    const provider = rule.getElementFromId('provider', resourceId);
    const resourceType = rule.getElementFromId('resourceType', resourceId);
    expect(subscription).to.equal(testSubId);
    expect(provider).to.equal('Microsoft.EventHub');
    expect(resourceType).to.equal('namespaces');
  });
});
