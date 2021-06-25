import {expect} from 'chai';
import {TerraformRule, RuleType} from '../../../src/rules';
import {Scanner} from '../../../src/scanner';

describe('Terraform Rule', () => {
  const rule = new TerraformRule({
    name: 'test-rule',
    evaluation: {
      query: 'mock query',
      and: [{query: 'mock `and` query'}],
    },
    recommendation: 'recommendationLink',
    description: 'Intentional bad query',
    type: RuleType.Terraform,
  });
  it('can produce a scan result', () => {
    const resources = [
      {address: 'mock-address-1'},
      {address: 'mock-address-2'},
    ];
    const scanResult = rule.toScanResult(resources);
    expect(scanResult).to.deep.equal({
      ruleName: rule.name,
      description: rule.description,
      total: 2,
      recommendation: rule.recommendation,
      resourceIds: ['mock-address-1', 'mock-address-2'],
    });
  });
  it('can render a query with a parent resource', () => {
    const query = "`{{parent.address}}` == 'parent-address'";
    const parent = {address: 'parent-address'};
    const renderedQuery = rule.render(query, parent);
    expect(renderedQuery).to.equal("`parent-address` == 'parent-address'");
  });
  it('can evaluate accidental-public-storage rule against a terraform JSON plan', async () => {
    const target = await TerraformRule.getTarget(
      './test/unit/tfplans/accidental-public-storage.tfplan.json'
    );
    const scanner = new Scanner();
    const results = await scanner.scan(target, './test/rules.json');
    expect(results[0]).to.contain.keys([
      'ruleName',
      'description',
      'recommendation',
      'total',
      'resourceIds',
    ]);
    expect(results[0].resourceIds).to.contain(
      'azurerm_storage_account.storage_account1'
    );
    expect(results[0].resourceIds).to.not.contain(
      'azurerm_storage_account.storage_account2'
    );
  });
});
