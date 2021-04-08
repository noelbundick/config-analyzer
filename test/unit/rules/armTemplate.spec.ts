import {expect} from 'chai';
import {resourceGroup, subscriptionId} from '../../azure';
import {ScanResult} from '../../../src/scanner';
import {ARMTemplateRule, RuleType} from '../../../src/rules';

describe('ARM Template Rule', () => {
  const rule = new ARMTemplateRule({
    type: RuleType.ARM,
    name: 'test-rule',
    description: 'use for testing rule methods',
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
  const testARMTarget = {
    type: 'ARM' as RuleType.ARM,
    subscriptionId: subscriptionId,
    groupName: resourceGroup,
    template: template,
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
      type: 'ARM' as RuleType.ARM,
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
      type: 'ARM' as RuleType.ARM,
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
      resourceIds: [rule.getResourceId(template.resources[0], testARMTarget)],
    };
    const resultShouldPass = await rule.execute(testARMTarget);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'failing');
  });
});
