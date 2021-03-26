import {assert, expect} from 'chai';
import {
  ResourceGraphRule,
  ResourceGraphTarget,
  RuleType,
} from '../../src/rules';
import {resourceGroup, resourceGroup2, subscriptionId} from '.';
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
