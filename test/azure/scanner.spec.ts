import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId} from '.';
import {ResourceGraphTarget, RuleType} from '../../src/rules';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can execute resource graph rules', async () => {
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionId,
    };
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    const totalResourceGraphRules = scanner.rules.filter(
      r => r.type === RuleType.ResourceGraph
    ).length;
    const rgResults = await scanner.scan(target);
    assert.equal(rgResults.length, totalResourceGraphRules);
    rgResults.forEach(r => {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resourceIds',
      ]);
    });
  });
});
