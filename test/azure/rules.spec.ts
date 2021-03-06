import {assert} from 'chai';
import {ResourceGraphRule, RuleContext} from '../../src/rules';
import {subscriptionId} from '.';

describe('Resource Graph Rule', function () {
  this.slow(5000);
  this.timeout(8000);

  it('can execute a resource graph rule and return a scan result', async () => {
    const query =
      "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'";
    const name = 'Dummy Rule';
    const description = 'Intentional bad query';
    const rule = {
      name,
      description,
      query,
    };
    const context: RuleContext = {
      type: 'resourceGraph',
      subscriptionId,
      rules: [rule],
    };
    const results = await ResourceGraphRule.execute(context);
    for (const result of results) {
      assert.equal(rule.name, result.ruleName);
      assert.equal(rule.description, result.description);
      assert.containsAllKeys(result, [
        'ruleName',
        'description',
        'total',
        'resources',
      ]);
      assert.equal(result.total, 0);
    }
  });
});
