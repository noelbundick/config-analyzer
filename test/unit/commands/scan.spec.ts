import {test} from '@oclif/test';

describe('Scan Unit Tests', function () {
  this.slow(3000);
  this.timeout(5000);
  test
    .stdout()
    .command(['scan'])
    .exit(2)
    .it('exits with error code 2 when running scan without a flag');
  test
    .stdout()
    .stderr()
    .command(['scan', '--scope'])
    .exit(2)
    .it('exits with error code 2 when running scan --scope without a value');
  test
    .stdout()
    .stderr()
    .command(['scan', '-s', 'subId1', '-s', 'subId2', '-g', 'resourceGroup'])
    .exit(2)
    .it(
      'exits with error code 2 when running providing multiple subscriptions and 1 or more resource groups'
    );
});
