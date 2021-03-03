import {assert} from 'chai';
import {Rule, ResourceGraphRule} from '../../src/rules';
import {subscriptionId} from '.';

describe('Resource Graph Rule', function () {
  this.slow(5000);
  this.timeout(8000);

  it('can execute a resource graph rule and return a scan result', async () => {
    const query =
      "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'";
    const name = 'Dummy Rule';
    const description = 'Intentional bad query';
    const rule: Rule = {
      name,
      query,
      description,
      type: 'resourceGraph',
    };
    const result = await ResourceGraphRule.execute(rule, subscriptionId);
    assert.equal(rule.name, result.ruleName);
    assert.equal(rule.description, result.description);
    assert.containsAllKeys(result, ['ruleName', 'description', 'total', 'ids']);
    assert.equal(result.total, 0);
  });
});
