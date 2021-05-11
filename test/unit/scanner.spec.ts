import {assert} from 'chai';
import {Scanner} from '../../src/scanner';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load rules from a JSON file', async () => {
    const scanner = new Scanner();
    const rules = await scanner.getRulesFromFile('./test/rules.json');
    for (const r of rules) {
      assert.containsAllKeys(r, ['name', 'description', 'type']);
    }
  });
});
