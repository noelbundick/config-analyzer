import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId, resourceGroup} from '.';
import {RuleContext} from '../../src/rules';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  const scanner = new Scanner();
  it('can load and execute resource graph rules from a JSON file', async () => {
    const rules = await scanner.getRulesFromFile(
      'resourceGraph',
      '../test/rules.json'
    );
    const results = await scanner.scan(rules, subscriptionId);
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

  it('can scan a subscription and resource group for vnets named vnet', async () => {
    const rule = {
      name: 'get-vnets',
      description: 'gets all vnets in a resource group',
      query: `Resources | where type =~ 'Microsoft.Network/virtualNetworks' | where resourceGroup=='${resourceGroup}' and name == 'vnet'`,
    };
    const ruleContext: RuleContext = {
      type: 'resourceGraph',
      subscriptionId,
      rules: [rule],
    };

    const results = await scanner.scan(ruleContext, subscriptionId);
    assert.equal(results.length, 1);
    results.forEach(r => {
      assert.equal(r.ruleName, rule.name);
      assert.equal(r.description, rule.description);
      assert.equal(r.total, 1);
      assert.equal(r.resources.length, 1);
    });
  });
});
