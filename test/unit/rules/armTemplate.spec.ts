import {expect} from 'chai';
import {resourceGroup, subscriptionId} from '../../azure';
import {ScanResult} from '../../../src/scanner';
import {
  ARMResource,
  ARMTarget,
  ARMTemplateRule,
  filterAsync,
  HttpMethods,
  Request,
  RuleType,
} from '../../../src/rules';
import {ResourceManagementClient} from '@azure/arm-resources';
import {TokenCredential} from '@azure/identity';

describe('ARM Template Rule', () => {
  const rule = new ARMTemplateRule({
    type: RuleType.ARM,
    name: 'test-rule',
    description: 'use for testing rule methods',
    recommendation: 'recommendationLink',
    evaluation: {
      query:
        'type == `Microsoft.Storage/storageAccounts` && properties.networkAcls.defaultAction == `Allow`',
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
        type: 'Microsoft.Storage/storageAccounts/privateEndpointConnections',
        apiVersion: '2021-01-01',
        name: 'storageAccountName/endpoint1',
        properties: {},
      },
    ],
  };
  const testARMTarget: ARMTarget = {
    type: RuleType.ARM,
    subscriptionId: subscriptionId,
    groupName: resourceGroup,
    template: template,
    client: {} as ResourceManagementClient,
    credential: {} as TokenCredential,
  };

  it('can produce a scan result', () => {
    const resourceIds = ['id1', 'id2'];
    const result = rule.toScanResult(resourceIds);
    expect(result.total).to.equal(2);
    expect(result.ruleName).to.equal(rule.name);
    expect(result.description).to.equal(rule.description);
    expect(result.resourceIds).to.deep.equal(resourceIds);
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

  it("can exclude resources when using the 'and' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evalutation - first eval should find a resource and the second eval excludes it from results",
      type: RuleType.ARM,
      recommendation: 'recommendationLink',
      evaluation: {
        query:
          'type == `Microsoft.Storage/storageAccounts` && name == `storageAccountName`',
        and: [
          {
            query:
              'type == `Microsoft.Storage/storageAccounts/privateEndpointConnections` && name == `nonExistentPrivateEndpoint`',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 0,
      recommendation: rule.recommendation,
      resourceIds: [],
    };
    const resultShouldPass = await rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'passing');
  });

  it("can match resources when using the 'and' key", async () => {
    const rule = new ARMTemplateRule({
      name: 'test-and-rule',
      description:
        "used for testing a rule with an 'and' evaluation - first eval should find a resource and should also find a resource",
      type: RuleType.ARM,
      recommendation: 'recommendationLink',
      evaluation: {
        query:
          'type == `Microsoft.Storage/storageAccounts` && name == `storageAccountName`',
        and: [
          {
            query:
              'type == `Microsoft.Storage/storageAccounts/privateEndpointConnections` && starts_with(name, `{{parent.name}}/`)',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 1,
      recommendation: rule.recommendation,
      resourceIds: [rule.getResourceId(template.resources[0], testARMTarget)],
    };
    const resultShouldPass = await rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'failing');
  });

  it('can build a request Url for the sendRequest method', () => {
    const evaluation = {
      query: '',
      request: [
        {
          query: '',
          httpMethod: HttpMethods.POST,
          operation: 'path/for/operation',
        },
      ],
    };
    const result = rule.getRequestUrl(
      testARMTarget,
      template.resources[0],
      evaluation.request[0] as Request
    );
    const expectedResult = `https://management.azure.com/subscriptions/${testARMTarget.subscriptionId}/resourceGroups/${testARMTarget.groupName}/providers/${template.resources[0].type}/${template.resources[0].name}/${evaluation.request[0].operation}?api-version=${template.resources[0].apiVersion}`;
    expect(result).to.equal(expectedResult);
  });

  it('validates the filterAsync and mapAsync Methods work with an empty array', async () => {
    const array = new Array<ARMResource>();
    const results = await filterAsync(array, () => Promise.resolve(false));
    expect(results).to.deep.equal([]);
  });
});
