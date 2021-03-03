import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId} from '.';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load and execute resource graph rules from a JSON file', async () => {
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    const rgResults = await scanner.scan('resourceGraph', subscriptionId);
    assert.equal(rgResults.length, 1);
    rgResults.forEach(r => {
      assert.containsAllKeys(r, ['ruleName', 'description', 'total', 'ids']);
      assert.equal(r.total, 0);
    });
    const dummyResults = await scanner.scan('dummy', '');
    assert.equal(dummyResults.length, 2);
    dummyResults.forEach(r => {
      assert.containsAllKeys(r, ['ruleName', 'description', 'total', 'ids']);
      assert.equal(r.total, 0);
    });
  });
});
