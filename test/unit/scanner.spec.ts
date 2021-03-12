import {assert} from 'chai';
import {Scanner} from '../../src/scanner';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load rules from a JSON file', async () => {
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    for (const r of scanner.rules) {
      assert.containsAllKeys(r, ['name', 'description', 'type']);
    }
  });
});
