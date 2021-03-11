import {assert} from 'chai';
import {DummyTarget, RuleType} from '../../src/rules';
import {Scanner} from '../../src/scanner';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load rules from a JSON file', async () => {
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    assert.isAtLeast(scanner.rules.length, 4);
    for (const r of scanner.rules) {
      assert.containsAllKeys(r, ['name', 'description', 'type']);
    }
  });

  it('can execute a dummy rule and return a scan result', async () => {
    const target: DummyTarget = {
      type: RuleType.Dummy,
      context: {},
    };
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    const results = await scanner.scan(target);
    assert.equal(results.length, 2);
    for (const r of results) {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resourceIds',
      ]);
      assert.equal(r.total, 0);
    }
  });
});
