import {assert} from 'chai';
import {getTestRules} from '..';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load rules from a JSON file', async () => {
    const rules = await getTestRules();
    for (const r of rules) {
      assert.containsAllKeys(r, ['name', 'description', 'type']);
    }
  });
});
