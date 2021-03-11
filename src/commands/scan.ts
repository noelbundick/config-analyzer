import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../scanner';
import {ResourceGraphTarget, DummyTarget, Target, RuleType} from '../rules';
import {format, LogOptions} from '../commandHelper';
import cli from 'cli-ux';
import chalk = require('chalk');

export default class Scan extends Command {
  private isDebugMode = false;
  private isVerbose = false;

  static description =
    'Scans Azure resources for potential configuration issues';

  static examples = [
    `$ aza scan --scope <SCOPE>
    [rule-name]
        [✓ | ❌][rule-description]     
        Resources:
                [resource-ids]

    [total-passing]
    [total-failing]
    [total-rules-scanned]   
`,
  ];

  static flags = {
    help: flags.help({char: 'h'}),
    scope: flags.string({
      char: 's',
      description: 'Azure subscription id to scan',
    }),
    dummy: flags.boolean({
      char: 'd',
      description: 'runs dummy rules to mock multi rule system',
    }),
    file: flags.string({
      char: 'f',
      description: 'JSON rules file path',
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'prints all results',
    }),
    debug: flags.boolean({
      description: 'prints debugging logs',
    }),
  };

  public log(message: string, options?: LogOptions) {
    const formattedMessage = format(message, options);
    super.log(formattedMessage);
  }

  private printResult(result: ScanResult) {
    this.log(result.ruleName, {bold: true, indent: 4});
    if (result.total) {
      this.log(`❌ ${result.description}`, {color: 'grey', indent: 6});
      this.log(`Resources (${result.total}):`, {indent: 6});
      for (const id of result.resourceIds) {
        this.log(id, {indent: 8});
      }
    } else {
      this.log(`${chalk.green('✓')} ${chalk.grey(result.description)}`, {
        indent: 6,
      });
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

  private print(results: ScanResult[]) {
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

  async run() {
    const {flags} = this.parse(Scan);
    const scanner = new Scanner();
    let target: Target;

    if (flags.verbose) this.isVerbose = true;
    if (flags.debug) this.isDebugMode = true;
    if (flags.scope) {
      target = {
        type: RuleType.ResourceGraph,
        subscriptionId: flags.scope,
      } as ResourceGraphTarget;
    } else if (flags.dummy) {
      target = {type: RuleType.Dummy, context: {}} as DummyTarget;
    } else {
      this.error('Command scan expects a Flag');
    }

    await scanner.loadRulesFromFile(flags.file);
    cli.action.start('Scanning');
    const results = await scanner.scan(target);
    cli.action.stop();
    this.print(results);
  }
}
