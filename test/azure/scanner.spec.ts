import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId} from '.';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load and execute resource graph rules from a JSON file', async () => {
    const scanner = new Scanner();
    try {
      const results = await scanner.scan(
        'resourceGraph',
        subscriptionId,
        '../test/rules.json'
      );
      results.forEach(r => {
        assert.containsAllKeys(r, ['ruleName', 'description', 'total', 'ids']);
        assert.equal(r.total, 0);
      });
    } catch (err) {
      throw new Error(err);
    }
  });
});
