import {expect, test} from '@oclif/test';

describe('Scan Unit Tests', function () {
  this.slow(3000);
  this.timeout(5000);
  test
    .stdout()
    .command(['scan', '--dummy', '--file', '../test/rules.json', '--verbose'])
    .it('runs scan --dummy --file ../test/rules.json --verbose', ctx => {
      expect(ctx.stdout).to.contain(
        '    dummy-rule-1\n      ✓ mocks a multiple rule system\n'
      );
      expect(ctx.stdout).to.contain(
        '    dummy-rule-2\n      ✓ mocks a multiple rule system\n'
      );
      expect(ctx.stdout).to.contain('2 passing');
      expect(ctx.stdout).to.contain('0 failing');
      expect(ctx.stdout).to.contain('2 scanned');
    });
  test
    .stdout()
    .command(['scan', '-d', '-f', '../test/rules.json'])
    .it('runs scan -d -f ../test/rules.json', ctx => {
      expect(ctx.stdout).to.not.contain('dummy-rule-1');
      expect(ctx.stdout).to.not.contain('dummy-rule-2');
      expect(ctx.stdout).to.contain('2 passing');
      expect(ctx.stdout).to.not.contain('0 failing');
      expect(ctx.stdout).to.contain('2 scanned');
    });
  test
    .stdout()
    .command(['scan'])
    .exit(2)
    .it(
      'exits with error code 2 when running scan without a flag',
      ({stdout}) => {
        expect(stdout).to.equal('');
      }
    );
});
