import {assert} from 'chai';
import {Scanner} from '../../src/scanner';
import {subscriptionId, resourceGroup} from '.';
import {RuleContext} from '../../src/rules';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  const scanner = new Scanner();
  it('can load and execute resource graph rules from a JSON file', async () => {
    const ruleContext = await scanner.getRulesFromFile(
      'resourceGraph',
      undefined,
      '../test/rules.json'
    );
    const target = {subscriptionId};
    const results = await scanner.scan(ruleContext, target);
    assert.equal(results.length, ruleContext.rules.length);
    results.forEach(r => {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resources',
      ]);
    });
  });

  it('can scan a execute a resource graph rule against a subscription', async () => {
    const rule = {
      name: 'get-vnets',
      description: 'gets all vnets in a resource group',
      query: `Resources | where type =~ 'Microsoft.Network/virtualNetworks' | where resourceGroup=='${resourceGroup}' and name == 'vnet'`,
    };
    const ruleContext: RuleContext = {
      type: 'resourceGraph',
      target: {subscriptionId},
      rules: [rule],
    };

    const results = await scanner.scan(ruleContext, ruleContext.target);
    assert.equal(results.length, 1);
    results.forEach(r => {
      assert.equal(r.ruleName, rule.name);
      assert.equal(r.description, rule.description);
      assert.equal(r.total, 1);
      assert.equal(r.resources.length, 1);
    });
  });
  it('can execute a resource graph rule against a subscription and resource group', async () => {
    const ruleContext = await scanner.getRulesFromFile(
      'resourceGraph',
      ['get-vnets'],
      '../test/rules.json'
    );
    const target = {subscriptionId, resourceGroups: [resourceGroup]};
    const results = await scanner.scan(ruleContext, target);
    assert.equal(results.length, 1, 'only one rule is run');
    results.forEach(r => {
      assert.containsAllKeys(r, [
        'ruleName',
        'description',
        'total',
        'resources',
      ]);
      assert.equal(r.total, 1, 'total resources is 1');
      assert.equal(r.ruleName, 'get-vnets', 'rule name is get-vnets');
    });
  });
});
