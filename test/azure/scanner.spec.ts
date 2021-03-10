import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {resourceGroup, subscriptionId} from '.';
import {ResourceGraphTarget, RuleType} from '../../src/rules';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  it('can load and execute resource graph rules from a JSON file', async () => {
    const rgTarget: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionId,
    };
    const scanner = new Scanner();
    await scanner.loadRulesFromFile('../test/rules.json');
    const rgResults = await scanner.scan(rgTarget);
    const re = new RegExp(`/resourceGroups/${resourceGroup}`);
    assert.isAtLeast(rgResults.length, 2);
    rgResults.forEach(r => {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resourceIds',
      ]);
      if (r.ruleName === 'get-vnets') {
        const groupResources = r.resourceIds.filter(id => re.test(id));
        assert.equal(groupResources.length, 1);
      }
    });
  });
});
