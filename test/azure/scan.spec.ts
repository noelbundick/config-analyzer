import {expect, test} from '@oclif/test';
import {resourceGroup, subscriptionId} from '.';

describe('Scan integration tests', function () {
  this.slow(4000);
  this.timeout(6000);
  test
    .stdout()
    .command(['scan', '--scope', subscriptionId])
    .it('runs scan --scope [subscriptionId]', async ctx => {
      expect(ctx.stdout).to.contain('passing', 'total passing');
      expect(ctx.stdout).to.contain('failing', 'total failing');
      expect(ctx.stdout).to.contain('scanned', 'total tests executed');
    });
  test
    .stdout()
    .command([
      'scan',
      '--scope',
      subscriptionId,
      '--group',
      resourceGroup,
      '--rule',
      'get-vms',
    ])
    .it('runs scan --scope [subscriptionId] --group --rule get-vms', ctx => {
      expect(ctx.stdout).to.contain('1 passing', 'total passing');
      expect(ctx.stdout).to.contain('1 scanned', 'total tests executed');
    });
  test
    .stdout()
    .command([
      'scan',
      '-s',
      subscriptionId,
      '-g',
      resourceGroup,
      '-r',
      'get-vms',
      '--verbose',
    ])
    .it('runs scan -s [subscriptionId] -g -r get-vms --verbose', ctx => {
      expect(ctx.stdout).to.contain('get-vms', 'total passing');
      expect(ctx.stdout).to.contain('1 passing', 'total passing');
      expect(ctx.stdout).to.contain('1 scanned', 'total tests executed');
    });
});
