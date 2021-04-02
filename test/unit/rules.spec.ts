import {expect} from 'chai';
import {
  ARMResource,
  ARMTarget,
  ARMTemplateRule,
  ResourceGraphRule,
  RuleType,
  Operator,
} from '../../src/rules';
import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {HttpHeadersLike, WebResourceLike} from '@azure/ms-rest-js';
import {assert} from 'chai';

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
  it('can modify a query to target resource groups', () => {
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
  it('should throw an error when modfiying an invalid query', () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      query: "where type =~ 'Microsoft.Network/virtualNetworks'",
      description: 'Does not include the inital table name',
      type: RuleType.ResourceGraph,
    });
    const groupNames = ['group1', 'group2'];
    expect(() => rule.getQueryByGroups(groupNames)).to.throw(
      "Invalid Query. All queries must start with '<tableName> |'"
    );
  });
});

describe('ARM Template Rule', function () {
  this.slow(15000);
  this.timeout(20000);
  const rule = new ARMTemplateRule({
    type: RuleType.ARM,
    name: 'dummy',
    description: 'dummy description',
    evaluation: {
      resourceType: 'Microsoft.Compute/virtualMachines',
      path: ['some', 'path'],
      operator: '==',
    },
  });

  it('can produce a scan result', () => {
    const resourceIds = ['id1', 'id2'];
    const result = rule.toScanResult(resourceIds);
    assert.equal(result.total, 2);
    assert.equal(result.ruleName, rule.name);
    assert.equal(result.description, rule.description);
    assert.deepEqual(result.resourceIds, resourceIds);
  });

  it('can build an a resourceId ARM template function with an unparameterized name', () => {
    const resource = {
      type: 'Microsoft.Storage/storageAccounts/blobServices',
      apiVersion: '2021-01-01',
      name: 'someName/default',
    };
    const expected =
      "[resourceId('Microsoft.Storage/storageAccounts/blobServices', 'someName', 'default')]";
    const actual = rule.buildARMFunction(resource);
    expect(actual).to.equal(expected);
  });

  it('can build an a resourceId ARM template function with an parameterized name', () => {
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: "[parameters('storageAccounts_azabhcf24jbcuxwo_name')]",
    };
    const expected =
      "[resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccounts_azabhcf24jbcuxwo_name'))]";
    const actual = rule.buildARMFunction(resource);
    expect(actual).to.equal(expected);
  });

  it('can convert an nonparmeterized ARM Resource to a Resource Id', () => {
    const resource = {
      apiVersion: '2019-06-01',
      type: 'Microsoft.Storage/storageAccounts',
      name: 'resourceName',
      location: '[resourceGroup().location]',
      sku: {
        name: 'Standard_LRS',
      },
      kind: 'StorageV2',
    };
    const target: ARMTarget = {
      type: RuleType.ARM,
      subscriptionId: 'subID',
      groupName: 'resourceGroupName',
      templateResources: [] as ARMResource[],
    };
    const expected = `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${resource.type}/${resource.name}`;
    const actual = rule.buildResourceId(resource, target);
    expect(actual).to.equal(expected);
  });
  it("can return the resource name (doesn't account for unparameterizing) when a subscription ID and resourceGroup is not provided", () => {
    const resource = {
      apiVersion: '2019-06-01',
      type: 'Microsoft.Storage/storageAccounts',
      name: "[parameters('name')]",
      location: '[resourceGroup().location]',
      sku: {
        name: 'Standard_LRS',
      },
      kind: 'StorageV2',
    };
    const target: ARMTarget = {
      type: RuleType.ARM,
      templateResources: [] as ARMResource[],
    };
    const actual = rule.buildResourceId(resource, target);
    expect(actual).to.equal(resource.name);
  });

  it('can resolve a valid path to an ARM template resource', () => {
    const path = ['properties', 'networkAcls', 'defaultAction'];
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'resourceName',
      location: 'westus2',
      properties: {
        networkAcls: {
          bypass: 'AzureServices',
          virtualNetworkRules: [],
          ipRules: [],
          defaultAction: 'Allow',
        },
      },
    };
    const actual = rule.resolveResourcePath(resource, path);
    expect(actual).to.equal(resource.properties.networkAcls.defaultAction);
  });
  it('can throw an error when an provided an invalid path to an ARM template resource', () => {
    const path = ['properties', 'networkAcls', 'defaultAction'];
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'resourceName',
      location: 'westus2',
      properties: {},
    };
    expect(() => {
      rule.resolveResourcePath(resource, path);
    }).to.throw(
      `The path '${path.join('.')}' was not resolved on the resource ${
        resource.name
      }`
    );
  });

  it('can get an expected value when a value is provided', () => {
    const evaluation = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'ipRules', 'length'],
      operator: '==' as Operator,
      value: 0,
    };
    const actual = rule.getValue(evaluation);
    expect(actual).to.equal(evaluation.value);
  });

  it('can get an expected value when a parent path is provided but a value is not provided', () => {
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'resourceName',
      location: 'westus2',
      properties: {
        networkAcls: {
          bypass: 'AzureServices',
          virtualNetworkRules: [],
          ipRules: [],
          defaultAction: 'Allow',
        },
      },
    };
    const evaluation = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['dummyPath'],
      operator: '==' as Operator,
      value: 'dummyValue',
      and: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['dummyPath'],
        operator: '==' as Operator,
        parentPath: ['properties', 'networkAcls', 'defaultAction'],
      },
    };
    const actual = rule.getValue(evaluation.and, resource);
    expect(actual).to.equal(resource.properties.networkAcls.defaultAction);
  });
  it('can get an expected value when a parent Id path provided', () => {
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'resourceName',
      location: 'westus2',
      properties: {
        networkAcls: {
          bypass: 'AzureServices',
          virtualNetworkRules: [],
          ipRules: [],
          defaultAction: 'Allow',
        },
      },
    };
    const evaluation = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['dummyPath'],
      operator: '==' as Operator,
      value: 'dummyValue',
      and: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['dummyPath'],
        operator: '==' as Operator,
        parentPath: ['properties', 'networkAcls', 'defaultAction'],
      },
    };
    const actual = rule.getValue(evaluation.and, resource);
    expect(actual).to.equal(resource.properties.networkAcls.defaultAction);
  });
});
