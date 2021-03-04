import {expect, test} from '@oclif/test';

describe('scan unit tests', () => {
  test
    .stdout()
    .command(['scan'])
    .exit(2)
    .it(
      'exits when status 2 when scan is not provided a Flag --scope',
      ({stdout}) => {
        expect(stdout).to.equal('Error: Command scan expects a --scope Flag\n');
      }
    );
});
