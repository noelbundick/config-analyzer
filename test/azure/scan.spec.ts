import {expect, test} from '@oclif/test';
import {resourceGroup, subscriptionId} from '.';

describe('Scan Integration Tests', function () {
  this.slow(4000);
  this.timeout(6000);
  test
    .stdout()
    .command([
      'scan',
      '--scope',
      subscriptionId,
      '--file',
      '../test/rules.json',
    ])
    .it('runs scan --scope [subscriptionId] --file ../test/rules.json', ctx => {
      expect(ctx.stdout).to.not.contain('    bad-query\n');
      expect(ctx.stdout).to.not.contain(
        '      ✓ Gets all vnets in a subscription\n'
      );
      expect(ctx.stdout).to.contain('    get-vnets\n');
      expect(ctx.stdout).to.contain(
        '      ❌ Gets all vnets in a subscription\n'
      );
      expect(ctx.stdout).to.contain('      Resources');
      expect(ctx.stdout).to.contain(
        `        /subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/virtualNetworks/vnet`
      );
      expect(ctx.stdout).to.contain('1 passing');
      expect(ctx.stdout).to.not.contain('failing');
      expect(ctx.stdout).to.contain('2 scanned');
    });
  test
    .stdout()
    .command([
      'scan',
      '--scope',
      subscriptionId,
      '--file',
      '../test/rules.json',
      '-v',
    ])
    .it(
      'runs scan --scope [subscriptionId] --file ../test/rules.json --verbose',
      ctx => {
        expect(ctx.stdout).to.contain('    bad-query\n');
        expect(ctx.stdout).to.contain('      ✓ Should return no results\n');
        expect(ctx.stdout).to.contain('    get-vnets\n');
        expect(ctx.stdout).to.contain(
          '      ❌ Gets all vnets in a subscription\n'
        );
        expect(ctx.stdout).to.contain('      Resources');
        expect(ctx.stdout).to.contain(
          `        /subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/virtualNetworks/vnet`
        );
        expect(ctx.stdout).to.contain('1 passing');
        expect(ctx.stdout).to.contain('1 failing');
        expect(ctx.stdout).to.contain('2 scanned');
      }
    );
});
