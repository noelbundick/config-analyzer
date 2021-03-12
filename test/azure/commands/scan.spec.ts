import {test, expect} from '@oclif/test';
import {subscriptionId} from '..';
import {RuleType} from '../../../src/rules';
import {Scanner} from '../../../src/scanner';

describe('Scan Unit Tests', function () {
  this.slow(3000);
  this.timeout(5000);
  test
    .stdout()
    .command(['scan', '--scope', subscriptionId, '-f', '../test/rules.json'])
    .it(
      'runs scan --scope [subscriptionId] -f ../test/rules.json',
      async ({stdout}) => {
        const scanner = new Scanner();
        await scanner.loadRulesFromFile('../test/rules.json');
        const totalResourceGraphRules = scanner.rules.filter(
          r => r.type === RuleType.ResourceGraph
        ).length;
        expect(stdout).to.contain(`${totalResourceGraphRules} scanned`);
      }
    );
});
