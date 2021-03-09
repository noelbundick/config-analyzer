import {expect, test} from '@oclif/test';

describe('scan unit tests', () => {
  test
    .stdout({print: false})
    .command(['scan', '--dummy', '-v'])
    .it('runs scan --dummy', ctx => {
      const rule1 =
        '    dummy-rule-1\n        ✓ Mocks a multiple rule system\n\n';
      const rule2 =
        '    dummy-rule-2\n        ✓ Mocks a multiple rule system\n\n';
      expect(ctx.stdout).to.contain(rule1);
      expect(ctx.stdout).to.contain(rule2);
      expect(ctx.stdout).to.contain('2 passing');
      expect(ctx.stdout).to.contain('2 scanned');
    });
  test
    .stdout({print: false})
    .command(['scan', '--dummy', '--rule', 'dummy-rule-1', '--verbose'])
    .it('runs scan --dummy --rule dummy-rule-1', ctx => {
      expect(ctx.stdout).to.contain('dummy-rule-1');
      expect(ctx.stdout).to.not.contain('dummy-rule-2');
    });
  test
    .stdout({print: false})
    .command(['scan', '-d', '-r', 'dummy-rule-2', '-v'])
    .it('runs scan -d -r dummy-rule-2 -v', ctx => {
      expect(ctx.stdout).to.contain('dummy-rule-2');
      expect(ctx.stdout).to.not.contain('dummy-rule-1');
      expect(ctx.stdout).to.contain('1 passing');
      expect(ctx.stdout).to.contain('1 scanned');
      expect(ctx.stdout).to.contain('✓ Mocks a multiple rule system');
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
