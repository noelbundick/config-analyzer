import {test, expect} from '@oclif/test';
import {resourceGroup, resourceGroup2, subscriptionId} from '..';
import {RuleType} from '../../../src/rules';
import {Scanner} from '../../../src/scanner';

describe('Scan Integration Tests', function () {
  this.slow(3000);
  this.timeout(5000);
  const nonExistingGroup = `i-should-exist-${Date.now()}-1`;
  const group1VNetId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/virtualNetworks/vnet`;
  const group2VNetId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup2}/providers/Microsoft.Network/virtualNetworks/vnet`;
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
  test
    .stdout()
    .command([
      'scan',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-f',
      '../test/rules.json',
    ])
    .it(
      'runs scan -s [subscriptionId] -g [resourceGroup] -f ../test/rules.json',
      async ({stdout}) => {
        expect(stdout).to.contain(group1VNetId);
        expect(stdout).to.not.contain(group2VNetId);
      }
    );
  test
    .stdout()
    .command([
      'scan',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-g',
      resourceGroup2,
      '-f',
      '../test/rules.json',
    ])
    .it(
      'runs scan -s [subscriptionId] -g [resourceGroup1] -g [resourceGroup2] -f ../test/rules.json',
      async ({stdout}) => {
        expect(stdout).to.contain(group1VNetId);
        expect(stdout).to.contain(group2VNetId);
      }
    );
  test
    .stderr()
    .command([
      'scan',
      '-s',
      subscriptionId,
      '-g',
      nonExistingGroup,
      '-g',
      resourceGroup,
      '-f',
      '../test/rules.json',
    ])
    .it(
      'should warn user of nonexisting resource groups in the subscription',
      async ({stderr}) => {
        expect(stderr).to.contain(nonExistingGroup);
        expect(stderr).to.not.contain(resourceGroup);
      }
    );
});
