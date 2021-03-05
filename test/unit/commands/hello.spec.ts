import {expect, test} from '@oclif/test';

describe('hello', function () {
  this.timeout(8000);
  test
    .stdout()
    .command(['hello'])
    .it('runs hello', ctx => {
      expect(ctx.stdout).to.contain('hello world');
    });

  test
    .stdout()
    .command(['hello', '--name', 'jeff'])
    .it('runs hello --name jeff', ctx => {
      expect(ctx.stdout).to.contain('hello jeff');
    });
});
