import {expect} from 'chai';
import {
  ARMTemplateRule,
  ResourceGraphRule,
  RuleType,
  Operator,
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
  const template = {
    $schema: '',
    contentVersion: '',
    parameters: {},
    variables: {},
    resources: [
      {
        type: 'Microsoft.Storage/storageAccounts',
        apiVersion: '2021-01-01',
        name: 'storageAccountName',
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
        type: '"Microsoft.Network/privateEndpoints',
        apiVersion: '2021-01-01',
        name: 'privateEndpointName',
        dependsOn: [
          "[resourceId('Microsoft.Storage/storageAccounts', storageAccountName)]",
        ],
      },
    ],
  };
  const testARMTarget = {
    type: 'ARM' as RuleType.ARM,
    subscriptionId: subscriptionId,
    groupName: resourceGroup,
    template: template,
  };

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
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2021-01-01',
      name: 'someName/default',
    };
    const expectedId =
      "[resourceId('Microsoft.Storage/storageAccounts', 'someName', 'default')]";
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
    const expectedId = `subscriptions/${testARMTarget.subscriptionId}/resourceGroups/${testARMTarget.groupName}/providers/${resource.type}/${resource.name}`;
    const actualId = rule.getResourceId(resource, testARMTarget);
    expect(actualId).to.equal(expectedId);
  });

  it('can resolve a valid path to an ARM template resource', () => {
    const path = ['properties', 'networkAcls', 'defaultAction'];
    const resource = template.resources[0];
    const actual = rule.resolvePath(path, resource);
    expect(actual).to.equal('Allow');
  });

  it('throws an error when resolving an invalid path to an ARM template resource', () => {
    const path = ['properties', 'networkAcls', 'invalidValue'];
    const resource = template.resources[0];
    const expectedErrorMsg =
      "The path 'properties.networkAcls.invalidValue' was not resolved on the resource Microsoft.Storage/storageAccounts/storageAccountName";
    expect(() => {
      rule.resolvePath(path, resource);
    }).to.throw(expectedErrorMsg);
  });

  it('can get an expected value when a value key is provided in the evalutation', () => {
    const actual = rule.getExpectedValue(rule.evaluation);
    expect(actual).to.equal('Allow');
  });

  it('can get a parent value from an evalution', () => {
    const resource = template.resources[0];
    const evaluation = {
      resourceType: '"Microsoft.Network/privateEndpoints',
      path: ['apiVersion'],
      operator: '==' as Operator,
      parentPath: ['apiVersion'],
    };
    const actual = rule.getExpectedValue(evaluation, resource);
    expect(actual).to.equal('2021-01-01');
  });

  it("can get a parent value when parentPath is ['id']", () => {
    const andEvalutaions = [
      {
        resourceType: '"Microsoft.Network/privateEndpoints',
        path: ['dependsOn'],
        operator: '==' as Operator,
        parentPath: ['id'],
      },
    ];
    const rule = new ARMTemplateRule({
      type: 'ARM' as RuleType.ARM,
      name: 'and-rule',
      description: 'A rule with a an and evaluation and a parent parent',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'storageAccountName',
        and: andEvalutaions,
      },
    });
    const resource = template.resources[0];
    const actualValue = rule.getExpectedValue(andEvalutaions[0], resource);
    const expectedValue =
      "[resourceId('Microsoft.Storage/storageAccounts', 'storageAccountName')]";
    expect(actualValue).to.equal(expectedValue);
  });

  it('can evalute an passing evalution with == operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'bypass'],
        operator: '==' as Operator,
        value: 'AzureServices',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results.length).to.equal(0);
  });

  it('can evalute an failing evaluation with == operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'bypass'],
        operator: '==' as Operator,
        value: 'nonPassingValue',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    const resourceId = rule.getResourceId(template.resources[0], testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results).to.contain(resourceId);
    expect(evalResults.results.length).to.equal(1);
  });

  it('can evalute a passing evaluation with != operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'bypass'],
        operator: '!=' as Operator,
        value: 'passingValue',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results.length).to.equal(0);
  });

  it('can evalute a failing evaluation with != operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'bypass'],
        operator: '!=' as Operator,
        value: 'AzureServices',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    const resourceId = rule.getResourceId(template.resources[0], testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results).to.contain(resourceId);
    expect(evalResults.results.length).to.equal(1);
  });

  it('can evalute a passing evaluation with in operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'virtualNetworkRules'],
        operator: 'in' as Operator,
        value: 'testVNetRule',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results.length).to.equal(0);
  });

  it('can evalute a failing evaluation with in operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'virtualNetworkRules'],
        operator: 'in' as Operator,
        value: 'failingValue',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    const resourceId = rule.getResourceId(template.resources[0], testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results).to.contain(resourceId);
    expect(evalResults.results.length).to.equal(1);
  });

  it('can evalute a passing evaluation with notIn operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'virtualNetworkRules'],
        operator: 'notIn' as Operator,
        value: 'failingValue',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results.length).to.equal(0);
  });

  it('can evalute a failing evaluation with notIn operator', () => {
    const rule = new ARMTemplateRule({
      type: RuleType.ARM,
      name: 'test-rule',
      description: 'use for testing rule methods',
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'virtualNetworkRules'],
        operator: 'notIn' as Operator,
        value: 'testVNetRule',
      },
    });
    const evalResults = rule.evaluate(rule.evaluation, testARMTarget);
    const resourceId = rule.getResourceId(template.resources[0], testARMTarget);
    expect(evalResults.results).to.be.instanceOf(Array);
    expect(evalResults.results).to.contain(resourceId);
    expect(evalResults.results.length).to.equal(1);
  });

  it("can execute a passing evaluation with 'and' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should fail and second eval should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '==' as Operator,
        value: 'valueToFail',
        and: [
          {
            resourceType: '"Microsoft.Network/privateEndpoints',
            path: ['name'],
            operator: '==' as Operator,
            value: 'privateEndpointName',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 0,
      resourceIds: [],
    };
    const resultShouldPass = rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'passing');
  });

  it("can execute a failing evaluation with 'and' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should fail and second eval should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '==' as Operator,
        value: 'valueToFail',
        and: [
          {
            resourceType: '"Microsoft.Network/privateEndpoints',
            path: ['name'],
            operator: '!=' as Operator,
            value: 'privateEndpointName',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 2,
      resourceIds: template.resources.map(r =>
        rule.getResourceId(r, testARMTarget)
      ),
    };
    const resultShouldPass = rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'failing');
  });

  it("can execute a passing evaluation with 'or' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should fail and second eval should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'valueToPass',
        or: [
          {
            resourceType: '"Microsoft.Network/privateEndpoints',
            path: ['name'],
            operator: '==' as Operator,
            value: 'privateEndpointName',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 0,
      resourceIds: [],
    };
    const resultShouldPass = rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'passing');
  });

  it("can execute a failing evaluation with 'or' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should fail and second eval should pass",
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['name'],
        operator: '!=' as Operator,
        value: 'valueToPass',
        or: [
          {
            resourceType: '"Microsoft.Network/privateEndpoints',
            path: ['name'],
            operator: '==' as Operator,
            value: 'failingValue',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 1,
      resourceIds: [rule.getResourceId(template.resources[1], testARMTarget)],
    };
    const resultShouldPass = rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'failing');
  });
});
