import {expect, test} from '@oclif/test';

describe('scan integration tests', () => {
  test
    .stdout()
    .command(['scan'])
    .exit(2)
    .it('exits with status 2 when scan is not provided a Flag', ({stdout}) => {
      expect(stdout).to.equal('');
    });
});
