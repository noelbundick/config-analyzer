import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import * as path from 'path';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load rules from a JSON file', async () => {
    const scanner = new Scanner();
    const absPath = path.join(__dirname, '../rules.json');
    await scanner.loadRulesFromFile(absPath);
    for (const r of scanner.rules) {
      assert.containsAllKeys(r, ['name', 'description', 'type']);
    }
  });
});
