import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../scanner';
import cli from 'cli-ux';
import {RuleContext, Rule} from '../rules';
import chalk = require('chalk');

export default class Scan extends Command {
  static description =
    'Scans azure resources for potential configuration issues';

  static examples = [
    `$ aza scan --scope <SCOPE>
`,
  ];

  static flags = {
    help: flags.help({char: 'h'}),
    scope: flags.string({
      char: 's',
      description: 'azure subscription, resoucres id to scan',
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
  };

  private totalRulesPassed(results: ScanResult[]) {
    const totals: number[] = results.map(r => {
      if (r.total === 0) return 1;
      return 0;
    });
    return totals.reduce((acc, curr) => acc + curr);
  }

  private logWithIndent(indents: number, msg: string) {
    let indent = '';
    if (indents) {
      indent = '    ';
      for (let i = indents; i > 0; i--) indent += '  ';
    }
    this.log(indent + msg);
  }

  private printResult(r: ScanResult) {
    const description = chalk.grey(r.description);
    const name = chalk.bold(r.ruleName);
    this.logWithIndent(1, name);

    if (r.total) {
      const redCheck = '\u274c ';
      this.logWithIndent(2, redCheck + description);
      this.logWithIndent(2, 'Resources:');
      for (const resource of r.resources) {
        this.logWithIndent(3, resource.id);
      }
    } else {
      const greenCheck = chalk.green('\u2713 ');
      this.logWithIndent(2, greenCheck + chalk.grey(r.description));
    }

    this.log('');
  }

  private printSummary(results: ScanResult[]) {
    const passed = this.totalRulesPassed(results);
    const total = results.length;
    const failed = total - passed;
    this.log(chalk.green(passed + ' passing'));
    failed && this.log(chalk.red(failed + ' failing'));
    this.log(total + ' scanned');
  }

  print(results: ScanResult[]) {
    for (const r of results) {
      this.printResult(r);
    }
    this.printSummary(results);
  }

  async scan(
    ruleType: RuleContext['type'],
    scope: string,
    ruleNames?: string[]
  ) {
    const scanner = new Scanner();
    const ruleContext = await scanner.getRulesFromFile(ruleType);
    if (ruleNames) {
      // fix this
      // const rules = ruleContext.rules;
      // rules.filter((r: Rule) => ruleNames.includes(r.name));
    }
    cli.action.start('Scanning');
    const results = await scanner.scan(ruleContext, scope);
    cli.action.stop();
    this.print(results);
  }

  async run() {
    const {flags} = this.parse(Scan);
    if (flags.scope) {
      this.scan('resourceGraph', flags.scope, flags.rule);
    } else if (flags.dummy) {
      this.scan('dummy', 'no target', flags.rule);
    } else {
      this.error('Command scan expects a Flag');
    }
  }
}
