import {assert} from 'chai';
import {
  ResourceGraphRule,
  ResourceGraphTarget,
  RuleType,
} from '../../src/rules';
import {subscriptionId} from '.';

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
      subscriptionId,
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
});
