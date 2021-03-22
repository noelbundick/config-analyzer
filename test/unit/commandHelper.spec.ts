import {expect} from 'chai';
import {format} from '../../src/commandHelper';

describe('Command Helper', () => {
  it('should format text with indents', () => {
    const message = 'message to format';
    const options = {
      indent: 2,
    };
    const formattedMessage = format(message, options);
    expect(formattedMessage).to.equal(
      `  ${message}`,
      'adds 2 spaces to the beginning of the message'
    );
  });
  it('should not add spaces with a negative indent', () => {
    const message = 'message to format';
    const options = {
      indent: -1,
    };
    const formattedMessage = format(message, options);
    expect(formattedMessage).to.equal(
      message,
      'no spaces added if indent number is < 0'
    );
  });
});
