import {assert} from 'chai';
import {
  ResourceGraphRule,
  ResourceGraphExecutor,
  ResourceGraphTarget,
  RuleType,
} from '../../src/rules';
import {subscriptionId} from '.';

describe('Resource Graph Rule', function () {
  this.slow(6000);
  this.timeout(10000);

  it('can execute a resource graph rule and return a scan result', async () => {
    const rule: ResourceGraphRule = {
      name: 'test-rule',
      query: "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'",
      description: 'Intentional bad query',
      type: RuleType.ResourceGraph,
    };
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionId,
    };
    const results = await ResourceGraphExecutor.execute([rule], target);
    for (const result of results) {
      assert.equal(rule.name, result.ruleName);
      assert.equal(rule.description, result.description);
      assert.containsAllKeys(result, [
        'ruleName',
        'description',
        'total',
        'resourceIds',
      ]);
      assert.equal(result.total, 0);
    }
  });
});
