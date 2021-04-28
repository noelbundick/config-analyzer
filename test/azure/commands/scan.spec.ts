import {test, expect} from '@oclif/test';
import {
  blobStorageAccountName,
  resourceGroup,
  resourceGroup2,
  runIntegrationTests,
  subscriptionId,
} from '..';
import {RuleType} from '../../../src/rules';
import {Scanner} from '../../../src/scanner';

describe('Scan Integration Tests', function () {
  this.slow(3000);
  this.timeout(20000);
  before(function () {
    if (!runIntegrationTests) {
      this.skip();
    }
  });
  const nonExistingGroup = `i-should-not-exist-${Date.now()}-1`;
  const group1VNetId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/virtualNetworks/vnet`;
  const group2VNetId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup2}/providers/Microsoft.Network/virtualNetworks/azatestvnet2`;
  test
    .stdout()
    .command([
      'scan:rg',
      '--subscription',
      subscriptionId,
      '-f',
      './test/rules.json',
    ])
    .it(
      'runs scan:rg --subscription [subscriptionId] -f ./test/rules.json',
      async ({stdout}) => {
        const scanner = new Scanner();
        await scanner.loadRulesFromFile('./test/rules.json');
        const totalResourceGraphRules = scanner.rules.filter(
          r => r.type === RuleType.ResourceGraph
        ).length;
        expect(stdout).to.contain(`${totalResourceGraphRules} scanned`);
      }
    );
  test
    .stdout()
    .command([
      'scan:rg',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-f',
      './test/rules.json',
    ])
    .it(
      'runs scan:rg -s [subscriptionId] -g [resourceGroup] -f ./test/rules.json',
      async ({stdout}) => {
        expect(stdout).to.contain(group1VNetId);
        expect(stdout).to.not.contain(group2VNetId);
      }
    );
  test
    .stdout()
    .command([
      'scan:rg',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-g',
      resourceGroup2,
      '-f',
      './test/rules.json',
    ])
    .it(
      'runs scan:rg -s [subscriptionId] -g [resourceGroup1] -g [resourceGroup2] -f ./test/rules.json',
      async ({stdout}) => {
        expect(stdout).to.contain(group1VNetId);
        expect(stdout).to.contain(group2VNetId);
      }
    );
  test
    .stderr()
    .command([
      'scan:rg',
      '-s',
      subscriptionId,
      '-g',
      nonExistingGroup,
      '-g',
      resourceGroup,
      '-f',
      './test/rules.json',
    ])
    .it(
      'should warn user of nonexisting resource groups in the subscription',
      async ({stderr}) => {
        expect(stderr).to.contain(nonExistingGroup);
        expect(stderr).to.not.contain(resourceGroup);
      }
    );
  test
    .stdout()
    .command([
      'scan:rg',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-f',
      './test/rules.json',
    ])
    .it(
      'should find storage accounts with a private endpoint configured but the public endpoint is still enabled with a Resource Graph query',
      async ({stdout}) => {
        const storageId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${blobStorageAccountName}`;
        expect(stdout).to.contain(storageId);
      }
    );
});
