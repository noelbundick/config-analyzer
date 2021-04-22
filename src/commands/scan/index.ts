import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../../scanner';
import {Target} from '../../rules';
import {format, LogOptions} from '../../commandHelper';
import cli from 'cli-ux';

export default class ScanCommand extends Command {
  protected isDebugMode = false;
  protected isVerbose = false;

  static description =
    'Command to scan Azure Resources for potential configuration issues';

  static examples = [
    `$ azca scan:rg --subscription <subscriptionId>
$ azca scan:arm --subscription <subscriptionId> --group <resourceGroupName>    
`,
  ];

  static flags = {
    file: flags.string({
      char: 'f',
      description: 'JSON rules file path',
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'prints all results',
    }),
    debug: flags.boolean({
      char: 'd',
      description: 'prints debugging logs',
    }),
  };

  public log(message: string, options?: LogOptions) {
    const formattedMessage = format(message, options);
    super.log(formattedMessage);
  }

  public logSameLine(messages: {message: string; options?: LogOptions}[]) {
    const formattedMessages = messages
      .map(l => format(l.message, l.options))
      .join('');
    super.log(formattedMessages);
  }

  private printResult(result: ScanResult) {
    this.log(result.ruleName, {bold: true, indent: 4});
    if (result.total) {
      this.log(`❌  ${result.description}`, {color: 'grey', indent: 6});
      if (result.recommendation) {
        const messages = [
          {message: 'How to Fix: ', options: {indent: 10}},
          {message: result.recommendation, options: {color: 'cyan'}},
        ];
        this.logSameLine(messages);
      }
      this.log(`Resources (${result.total}):`, {indent: 10});
      for (const id of result.resourceIds) {
        this.log(id, {indent: 14});
      }
    } else {
      const messages = [
        {message: '✓  ', options: {color: 'green', indent: 6}},
        {message: result.description, options: {color: 'grey'}},
      ];
      this.logSameLine(messages);
    }
    this.log('');
  }

  private printSummary(results: ScanResult[]) {
    const total = results.length;
    const totalPassed = results.filter(r => !r.total).length;
    const totalFailed = total - totalPassed;
    this.log(`${totalPassed} passing`, {
      color: 'green',
    });
    this.log(`${totalFailed} failing`, {
      color: 'red',
    });
    this.log(`${total} scanned`);
  }

  protected print(results: ScanResult[]) {
    for (const r of results) {
      if (this.isVerbose || r.total) {
        this.printResult(r);
      }
    }
    this.printSummary(results);
  }

  async catch(error: Error) {
    if (this.isDebugMode) console.log(error);
    throw error;
  }

  async scan(target: Target, rulesFile: string | undefined) {
    const scanner = new Scanner();
    await scanner.loadRulesFromFile(rulesFile);
    cli.action.start('Scanning');
    const results = await scanner.scan(target);
    cli.action.stop();
    this.print(results);
  }

  async run() {
    // oclif doesn't recognize help flag without this line.
    this.parse(ScanCommand);
    this.error(
      'Please provide a rule type to scan. Run `$ azca scan --help` for usage'
    );
  }
}
