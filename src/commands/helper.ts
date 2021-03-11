import chalk = require('chalk');

export interface LogOptions {
  indent?: number;
  color?: string;
  bold?: boolean;
}

export const format = (message: string, options?: LogOptions) => {
  let formattedMessage = message;
  if (options?.indent && options.indent > 0) {
    formattedMessage = ' '.repeat(options.indent) + formattedMessage;
  }
  if (options?.color) {
    formattedMessage = chalk.keyword(options.color)(formattedMessage);
  }
  if (options?.bold) {
    formattedMessage = chalk.bold(formattedMessage);
  }
  return formattedMessage;
};
