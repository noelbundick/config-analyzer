import {expect} from 'chai';
import {Scanner} from '../../src/scanner';

describe('Scanner', function () {
  this.slow(5000);
  this.timeout(8000);
  const scanner = new Scanner();
  it('can filter rules by name', async () => {
    const ruleNames = ['dummy-rule-2', 'dummy-rule-3'];
    const ruleContext = await scanner.getRulesFromFile(
      'dummy',
      ruleNames,
      '../test/rules.json'
    );

    const rule2 = ruleContext.rules[0];
    const rule3 = ruleContext.rules[1];
    expect(ruleContext.rules.length).to.equal(2);
    expect(ruleContext.type).to.equal('dummy');
    expect(rule2.name).to.equal('dummy-rule-2');
    expect(rule3.name).to.equal('dummy-rule-3');
  });
});
