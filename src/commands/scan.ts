import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../scanner';
import cli from 'cli-ux';
import {RuleContext} from '../rules';
import chalk = require('chalk');

export default class Scan extends Command {
  private _isVerbose = false;
  private _isDebugMode = false;

  static description =
    'Scans azure resources for potential configuration issues';

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
      description: 'azure subscription id to scan',
    }),
    group: flags.string({
      description: 'azure subscription id to scan',
      char: 'g',
      multiple: true,
      dependsOn: ['scope'],
    }),
    rule: flags.string({
      char: 'r',
      description: 'rules to execute',
      multiple: true,
    }),
    dummy: flags.boolean({
      char: 'd',
      description: 'runs dummy rules to mock multi rule system',
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'prints all results',
    }),
    debug: flags.boolean({
      description: 'prints debugging logs',
    }),
  };

  private _logWithIndent(indentNum: number, msg: string) {
    let indent = '';
    if (indentNum) {
      indent = '  ';
      for (let i = indentNum; i > 0; i--) {
        indent += indent;
      }
    }
    this.log(indent + msg);
  }

  private _printResult(r: ScanResult) {
    if (this._isVerbose || r.total) {
      const description = chalk.grey(r.description);
      const name = chalk.bold(r.ruleName);
      this._logWithIndent(1, name);

      if (r.total) {
        const redCheck = '\u274c ';
        this._logWithIndent(2, redCheck + description);
        this._logWithIndent(2, `Resources (${r.resources.length}):`);
        for (const resource of r.resources) {
          this._logWithIndent(3, resource.id);
        }
      } else {
        const greenCheck = chalk.green('\u2713 ');
        this._logWithIndent(2, greenCheck + chalk.grey(r.description));
      }
      this.log('');
    }
  }

  private _totalRulesPassed(results: ScanResult[]) {
    let passing = 0;
    for (const r of results) {
      if (!r.total) passing++;
    }
    return passing;
  }

  private printSummary(results: ScanResult[]) {
    const totalPassed = this._totalRulesPassed(results);
    const total = results.length;
    const totalFailed = total - totalPassed;
    this.log(chalk.green(totalPassed + ' passing'));
    totalFailed && this.log(chalk.red(totalFailed + ' failing'));
    this.log(total + ' scanned');
  }

  private _print(results: ScanResult[]) {
    for (const r of results) {
      this._printResult(r);
    }
    this.printSummary(results);
  }

  private async _scan(
    ruleType: RuleContext['type'],
    target: RuleContext['target'],
    ruleNames?: string[]
  ) {
    const scanner = new Scanner();
    const ruleContext = await scanner.getRulesFromFile(ruleType, ruleNames);
    cli.action.start('Scanning');
    const results = await scanner.scan(ruleContext, target);
    cli.action.stop();
    this._print(results);
  }

  async catch(error: Error) {
    if (this._isDebugMode) console.log(error);
    throw error;
  }

  async run() {
    const {flags} = this.parse(Scan);
    if (flags.verbose) this._isVerbose = true;
    if (flags.debug) this._isDebugMode = true;
    if (flags.scope) {
      const subscriptionId = flags.scope;
      const resourceGroups = flags.group;
      const target = {
        subscriptionId,
        resourceGroups,
      };
      await this._scan('resourceGraph', target, flags.rule);
    } else if (flags.dummy) {
      await this._scan('dummy', {target: 'no target'}, flags.rule);
    } else {
      this.error('Command scan expects a Flag');
    }
  }
}
