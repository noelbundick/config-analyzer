import {expect, test} from '@oclif/test';

describe('scan unit tests', () => {
  test
    .stdout({print: false})
    .command(['scan', '--dummy'])
    .it('runs scan --dummy', async ctx => {
      expect(ctx.stdout).to.contain('dummy-rule-1');
      expect(ctx.stdout).to.contain('dummy-rule-2');
    });
  test
    .stdout({print: false})
    .command(['scan', '--dummy', '--rule', 'dummy-rule-1'])
    .it('runs scan --dummy --rule dummy-rule-1', async ctx => {
      expect(ctx.stdout).to.contain('dummy-rule-1');
      expect(ctx.stdout).to.not.contain('dummy-rule-2');
    });
  test
    .stdout({print: false})
    .command(['scan', '-d', '-r', 'dummy-rule-2'])
    .it('runs scan -d -r dummy-rule-2', async ctx => {
      expect(ctx.stdout).to.contain('dummy-rule-2');
      expect(ctx.stdout).to.not.contain('dummy-rule-1');
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
