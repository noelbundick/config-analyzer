import {expect} from 'chai';
import {ResourceGraphRule, RuleType} from '../../src/rules';
import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {HttpHeadersLike, WebResourceLike} from '@azure/ms-rest-js';

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
    query: 'mock query',
    description: 'Intentional bad query',
    type: RuleType.ResourceGraph,
  });
  it('can produce a scan result', () => {
    const scanResult = rule.toScanResult(mockResourcesResponse());
    expect(scanResult).to.deep.equal({
      ruleName: rule.name,
      description: rule.description,
      total: 1,
      resourceIds: ['mockResourceId'],
    });
  });
  it("should throw an errow if the 'id' column is not returned from Resource Graph", () => {
    const resourcesResponse = mockResourcesResponse();
    resourcesResponse.data.columns = [];
    const iThrowError = () => rule.toScanResult(resourcesResponse);
    expect(iThrowError).to.throw(
      Error,
      'Id column was not returned from Azure Resource Graph'
    );
  });
  it("can modify a query that does not start with 'Resources |' to include resource groups", () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      query: "Resources | where type =~ 'Microsoft.Network/virtualNetworks'",
      description: 'Intentional bad query',
      type: RuleType.ResourceGraph,
    });
    const groupNames = ['group1', 'group2', 'group3'];
    const modifiedQuery = rule.getQueryByGroups(groupNames);
    const expectedQuery =
      "Resources | where resourceGroup in~ ('group1', 'group2', 'group3') | where type =~ 'Microsoft.Network/virtualNetworks'";
    expect(modifiedQuery).to.equal(expectedQuery);
  });
  it("can modify a query that does not start with 'Resources |' to include resource groups", () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      query: "where type =~ 'Microsoft.Network/virtualNetworks'",
      description: 'Intentional bad query',
      type: RuleType.ResourceGraph,
    });
    const groupNames = ['group1', 'group2', 'group3'];
    const modifiedQuery = rule.getQueryByGroups(groupNames);
    const expectedQuery =
      "Resources | where resourceGroup in~ ('group1', 'group2', 'group3') | where type =~ 'Microsoft.Network/virtualNetworks'";
    expect(modifiedQuery).to.equal(expectedQuery);
  });
});
