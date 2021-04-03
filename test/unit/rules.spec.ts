import {expect} from 'chai';
import {
  ARMResource,
  ARMTarget,
  ARMTemplateRule,
  ResourceGraphRule,
  RuleType,
  Operator,
  ARMEvaluation,
} from '../../src/rules';
import {ResourceGraphModels} from '@azure/arm-resourcegraph';
import {HttpHeadersLike, WebResourceLike} from '@azure/ms-rest-js';
import {assert} from 'chai';
import {resourceGroup, subscriptionId} from '../azure';
import {ScanResult} from '../../src/scanner';

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

describe('ARM Template Rule', () => {
  const rule = new ARMTemplateRule({
    type: RuleType.ARM,
    name: 'test-rule',
    description: 'use for testing rule methods',
    evaluation: {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'defaultAction'],
      operator: '==',
      value: 'Allow',
    },
  });

  const testResources = [
    {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'storageAccountName',
      location: 'westus2',
      sku: {
        name: 'Standard_LRS',
        tier: 'Standard',
      },
      kind: 'StorageV2',
      properties: {
        networkAcls: {
          bypass: 'AzureServices',
          virtualNetworkRules: ['testVNetRule'],
          ipRules: [],
          defaultAction: 'Allow',
        },
      },
    },
    {
      type: 'Microsoft.Storage/storageAccounts/privateEndpointConnections',
      apiVersion: '2021-01-01',
      name: 'privateEndpointConnectionName',
      dependsOn: [
        "[resourceId('Microsoft.Storage/storageAccounts', storageAccountName)]",
      ],
    },
  ];

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
    const expectedId =
      "[resourceId('Microsoft.Storage/storageAccounts/blobServices', 'someName', 'default')]";
    const actualId = rule.toResourceIdARMFunction(resource);
    expect(actualId).to.equal(expectedId);
  });

  it('can build an a resourceId ARM template function from a resource with a parameterized name', () => {
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: "[parameters('storageAccountName')]",
    };
    const expected =
      "[resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]";
    const actual = rule.toResourceIdARMFunction(resource);
    expect(actual).to.equal(expected);
  });

  it('can convert an nonparmeterized ARM Resource to a subscription scoped Resource Id', () => {
    const resource = {
      apiVersion: '2019-06-01',
      type: 'Microsoft.Storage/storageAccounts',
      name: 'resourceName',
    };
    const target: ARMTarget = {
      type: RuleType.ARM,
      subscriptionId: 'subID',
      groupName: 'resourceGroupName',
      templateResources: [resource],
    };
    const expectedId = `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${resource.type}/${resource.name}`;
    const actualId = rule.getResourceId(resource, target);
    expect(actualId).to.equal(expectedId);
  });
  it('returns the resource name when a subscription ID and resourceGroup is not provided in the target', () => {
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
    const actual = rule.getResourceId(resource, target);
    expect(actual).to.equal(resource.name);
  });

  it('returns the resource name when a subscription ID and resourceGroup is provided in the target but the name is parameterized', () => {
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
    const actual = rule.getResourceId(resource, target);
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
  it('throws an error when resolving an invalid path to an ARM template resource', () => {
    const path = ['properties', 'networkAcls', 'defaultAction'];
    const resource = {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'resourceName',
      properties: {},
    };
    const expectedErrorMsg =
      "The path 'properties.networkAcls.defaultAction' was not resolved on the resource Microsoft.Storage/storageAccounts/resourceName";
    expect(() => {
      rule.resolveResourcePath(resource, path);
    }).to.throw(expectedErrorMsg);
  });

  it('can get an expected value when a value key is provided in the evalutation', () => {
    const actual = rule.getValue(rule.evaluation);
    expect(actual).to.equal('Allow');
  });

  it('can get a parent value', () => {
    const resource = testResources[0];
    const rule = new ARMTemplateRule({
      type: 'ARM' as RuleType.ARM,
      name: 'and-rule',
      description: 'A rule with a an and evaluation and a parent parent',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '==' as Operator,
        value: 'failingValue',
        and: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['apiVersion'],
            operator: '==' as Operator,
            parentPath: ['apiVersion'],
          },
        ],
      },
    });
    const actual = rule.getValue(
      {
        resourceType:
          'Microsoft.Storage/storageAccounts/privateEndpointConnections',
        path: ['apiVersion'],
        operator: '==' as Operator,
        parentPath: ['apiVersion'],
      },
      resource
    );
    expect(actual).to.equal('2021-01-01');
  });
  it("can get a parent value when parentPath is ['id']", () => {
    const rule = new ARMTemplateRule({
      type: 'ARM' as RuleType.ARM,
      name: 'and-rule',
      description: 'A rule with a an and evaluation and a parent parent',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'storageAccountName',
        and: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['dependsOn'],
            operator: '==' as Operator,
            parentPath: ['id'],
          },
        ],
      },
    });
    const resource = testResources[0];
    const andEvalutaion = {
      resourceType:
        'Microsoft.Storage/storageAccounts/privateEndpointConnections',
      path: ['dependsOn'],
      operator: '==' as Operator,
      parentPath: ['id'],
    };
    const actualValue = rule.getValue(andEvalutaion, resource);
    const expectedValue =
      "[resourceId('Microsoft.Storage/storageAccounts', 'storageAccountName')]";
    expect(actualValue).to.equal(expectedValue);
  });
  it('can evalute an evaluation with == operator', () => {
    const evalShouldPass = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'bypass'],
      operator: '==' as Operator,
      value: 'AzureServices',
    };
    const evalShouldFail = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'bypass'],
      operator: '==' as Operator,
      value: 'Azure',
    };
    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const resourceId = rule.getResourceId(testResources[0], target);
    const resultShouldPass = rule.evaluate(evalShouldPass, target, []);
    const resultShouldFail = rule.evaluate(evalShouldFail, target, []);
    expect(resultShouldPass).to.be.instanceOf(Array);
    expect(resultShouldPass.length).to.equal(0);
    expect(resultShouldFail.length).to.equal(1);
    expect(resultShouldFail[0]).to.equal(resourceId);
  });
  it('can evalute an evaluation with != operator', () => {
    const evalShouldPass = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'bypass'],
      operator: '!=' as Operator,
      value: 'Azure',
    };
    const evalShouldFail = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'bypass'],
      operator: '!=' as Operator,
      value: 'AzureServices',
    };

    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const resourceId = rule.getResourceId(testResources[0], target);
    const resultShouldPass = rule.evaluate(evalShouldPass, target, []);
    const resultShouldFail = rule.evaluate(evalShouldFail, target, []);
    expect(resultShouldPass).to.be.instanceOf(Array);
    expect(resultShouldPass.length).to.equal(0);
    expect(resultShouldFail.length).to.equal(1);
    expect(resultShouldFail[0]).to.equal(resourceId);
  });
  it('can evalute an evaluation with in operator', () => {
    const evalShouldPass = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'virtualNetworkRules'],
      operator: 'in' as Operator,
      value: 'testVNetRule',
    };
    const evalShouldFail = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'virtualNetworkRules'],
      operator: 'in' as Operator,
      value: 'shouldntBeFound',
    };

    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const resourceId = rule.getResourceId(testResources[0], target);
    const resultShouldPass = rule.evaluate(evalShouldPass, target, []);
    const resultShouldFail = rule.evaluate(evalShouldFail, target, []);
    expect(resultShouldPass).to.be.instanceOf(Array);
    expect(resultShouldPass.length).to.equal(0);
    expect(resultShouldFail.length).to.equal(1);
    expect(resultShouldFail[0]).to.equal(resourceId);
  });
  it('can evalute an evaluation with notIn operator', () => {
    const evalShouldPass = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'virtualNetworkRules'],
      operator: 'notIn' as Operator,
      value: 'notFoundValue',
    };
    const evalShouldFail = {
      resourceType: 'Microsoft.Storage/storageAccounts',
      path: ['properties', 'networkAcls', 'virtualNetworkRules'],
      operator: 'notIn' as Operator,
      value: 'testVNetRule',
    };

    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const resourceId = rule.getResourceId(testResources[0], target);
    const resultShouldPass = rule.evaluate(evalShouldPass, target, []);
    const resultShouldFail = rule.evaluate(evalShouldFail, target, []);
    expect(resultShouldPass).to.be.instanceOf(Array);
    expect(resultShouldPass.length).to.equal(0);
    expect(resultShouldFail.length).to.equal(1);
    expect(resultShouldFail[0]).to.equal(resourceId);
  });
  it("can execute an evaluation with 'and' key", () => {
    const ruleShouldPass = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should fail and second eval should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '==' as Operator,
        value: 'valueToFailFirstEval',
        and: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['name'],
            operator: '==' as Operator,
            value: 'privateEndpointConnectionName',
          },
        ],
      },
    });
    const ruleShouldFail = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first and second evals should fail'",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '==' as Operator,
        value: 'valueToFailFirstEval',
        and: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['name'],
            operator: '!=' as Operator,
            value: 'privateEndpointConnectionName',
          },
        ],
      },
    });

    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const expectedPassingResult: ScanResult = {
      ruleName: ruleShouldPass.name,
      description: ruleShouldPass.description,
      total: 0,
      resourceIds: [],
    };
    const expectedFailingResult: ScanResult = {
      ruleName: ruleShouldFail.name,
      description: ruleShouldFail.description,
      total: 2,
      resourceIds: target.templateResources.map(resource =>
        ruleShouldFail.getResourceId(resource, target)
      ),
    };
    const resultShouldPass = ruleShouldPass.execute(target);
    const resultShouldFail = ruleShouldFail.execute(target);
    expect(resultShouldPass).to.deep.equal(expectedPassingResult, 'passing');
    expect(resultShouldFail).to.deep.equal(expectedFailingResult, 'failing');
  });
  it("can execute an evaluation with 'or' key", () => {
    const ruleShouldPass = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - both evals should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'passingValue',
        or: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['name'],
            operator: '==' as Operator,
            value: 'privateEndpointConnectionName',
          },
        ],
      },
    });
    const ruleShouldFail = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should pass but the second should fail'",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'passingValue',
        or: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['name'],
            operator: '!=' as Operator,
            value: 'privateEndpointConnectionName',
          },
        ],
      },
    });

    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: testResources,
    };
    const expectedPassingResult: ScanResult = {
      ruleName: ruleShouldPass.name,
      description: ruleShouldPass.description,
      total: 0,
      resourceIds: [],
    };
    const expectedFailingResult: ScanResult = {
      ruleName: ruleShouldFail.name,
      description: ruleShouldFail.description,
      total: 1,
      resourceIds: [
        ruleShouldFail.getResourceId(target.templateResources[1], target),
      ],
    };
    const resultShouldPass = ruleShouldPass.execute(target);
    const resultShouldFail = ruleShouldFail.execute(target);
    expect(resultShouldPass).to.deep.equal(expectedPassingResult, 'passing');
    expect(resultShouldFail).to.deep.equal(expectedFailingResult, 'failing');
  });
});
