import {expect} from 'chai';
import {format} from '../../src/commandHelper';

describe('Command Helper', () => {
  it('should format text with indents', () => {
    const message = 'message to format';
    const options = {
      indent: 2,
    };
    let formattedMessage = format(message, options);
    expect(formattedMessage).to.equal('  ' + message, 'adds 2 spaces');

    options.indent = -1;
    formattedMessage = format(message, options);
    expect(formattedMessage).to.equal(
      message,
      'no spaces added if indent number is < 0'
    );
  });
});
