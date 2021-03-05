import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId} from '.';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load and execute resource graph rules from a JSON file', async () => {
    const scanner = new Scanner();
    const rules = await scanner.getRulesFromFile('dummy', '../test/rules.json');
    const results = await scanner.scan(rules, subscriptionId);
    // assert.equal(results.length, 1);
    // results.forEach(r => {
    //   assert.containsAllKeys(r, ['ruleName', 'description', 'total', 'ids']);
    //   assert.equal(r.total, 0);
    // });
    // const dummyResults = await scanner.scan('dummy', '');
    assert.equal(results.length, 2);
    results.forEach(r => {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resources',
      ]);
      assert.equal(r.total, 0);
    });
  });
});
