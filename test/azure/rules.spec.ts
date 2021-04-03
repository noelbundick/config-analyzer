import {assert, expect} from 'chai';
import {
  ARMTemplateRule,
  Operator,
  ResourceGraphRule,
  ResourceGraphTarget,
  RuleType,
} from '../../src/rules';
import {credential, resourceGroup, resourceGroup2, subscriptionId} from '.';
import {DefaultAzureCredential} from '@azure/identity';

describe('Resource Graph Rule', function () {
  this.slow(6000);
  this.timeout(10000);

  it('can execute a resource graph rule and return a scan result', async () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      description: 'Intentional bad query',
      query: "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'",
      type: RuleType.ResourceGraph,
    });
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionIds: [subscriptionId],
      credential: new DefaultAzureCredential(),
    };
    const result = await rule.execute(target);
    assert.equal(rule.name, result.ruleName);
    assert.equal(rule.description, result.description);
    assert.containsAllKeys(result, [
      'ruleName',
      'description',
      'total',
      'resourceIds',
    ]);
    assert.equal(result.total, 0);
  });
  it('should return any non existing resource groups in a subscription', async () => {
    const nonExistingGroup1 = `i-should-exist-${Date.now()}-1`;
    const nonExistingGroup2 = `i-should-exist-${Date.now()}-2`;
    const groupNames = [
      nonExistingGroup1,
      nonExistingGroup2,
      resourceGroup,
      resourceGroup2,
    ];
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionIds: [subscriptionId],
      credential: new DefaultAzureCredential(),
      groupNames,
    };
    const nonExistingGroups = await ResourceGraphRule.getNonExistingResourceGroups(
      target
    );
    expect(nonExistingGroups).to.contain(nonExistingGroup1);
    expect(nonExistingGroups).to.contain(nonExistingGroup2);
    expect(nonExistingGroups).to.not.contain(resourceGroup);
    expect(nonExistingGroups).to.not.contain(resourceGroup2);
  });
});

describe('ARM Template Rule', function () {
  this.slow(15000);
  this.timeout(20000);
  it('can get an execute an accidental storage rule scoped to a Resource Group', async () => {
    const rule = new ARMTemplateRule({
      name: 'accidental-public-storage',
      description:
        'Finds Storage Accounts with a Private Endpoint configured but the public endpoint is still enabled',
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        resourceType: 'Microsoft.Storage/storageAccounts',
        path: ['properties', 'networkAcls', 'defaultAction'],
        operator: '!=' as Operator,
        value: 'Allow',
        and: [
          {
            resourceType:
              'Microsoft.Storage/storageAccounts/privateEndpointConnections',
            path: ['dependsOn'],
            operator: 'notIn' as Operator,
            parentPath: ['id'],
          },
        ],
      },
    });
    const template = await ARMTemplateRule.getTemplate(
      subscriptionId,
      resourceGroup
    );
    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      templateResources: template._response.parsedBody.template.resources,
    };
    // clean this up to not have hard coded values
    const storageAccountName = 'azabhcf24jbcuxwo';
    const privateEndpointName =
      'azabhcf24jbcuxwo/azabhcf24jbcuxwo.1274fbe6-5b85-4103-8412-7557abd3bc95';
    const expectedResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 2,
      resourceIds: [
        `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/${rule.evaluation.resourceType}/${storageAccountName}`,
        `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/Microsoft.Storage/storageAccounts/privateEndpointConnections/${privateEndpointName}`,
      ],
    };
    const result = rule.execute(target);
    expect(result).to.deep.equal(expectedResult);
  });
});
