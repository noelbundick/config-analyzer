import {Command, flags} from '@oclif/command';
import {Id, Scanner, ScanResult} from '../scanner';
import cli from 'cli-ux';
import {RuleContext} from '../rules';

export default class Scan extends Command {
  static description =
    'Scans azure resources for potential configuration issues';

  static examples = [
    `$ aza scan --scope <SCOPE>
Rule       Description   Result 
[ruleName] [description] [Pass/Fail]
Resource IDs ([total]):
[resourceId]
====================================
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

  private _ruleInfoColumns = {
    rule: {
      get: (row: ScanResult) => row.ruleName,
    },
    description: {
      get: (row: ScanResult) => row.description,
    },
    result: {
      get: (row: ScanResult) => (row.total ? 'Fail' : 'Pass'),
    },
  };

  private _resourcesColumn(total: number) {
    return {
      resources: {
        header: `Resource IDs (${total}):`,
        get: (resource: Id) => resource.id,
      },
    };
  }

  private _printDivider(result: ScanResult) {
    const maxRowLength = this._maxRowLength(result);
    let divider = '';
    for (let i = 0; i < maxRowLength; i++) divider += '=';
    this.log(divider);
    this.log('\n');
  }

  private _maxRowLength(result: ScanResult) {
    const row1Length = result.ruleName.length + result.description.length;
    const row2Lengths = result.resources.map(({id}) => id.length);
    return Math.max(row1Length, ...row2Lengths);
  }

  print(results: ScanResult[]) {
    for (const r of results) {
      // rule information table
      cli.table([r], this._ruleInfoColumns);

      // resource ids table
      if (r.total) {
        cli.table(r.resources, this._resourcesColumn(r.resources.length), {
          'no-truncate': true,
        });
      }

      this._printDivider(r);
    }
  }

  async scan(
    ruleType: RuleContext['type'],
    scope: string,
    ruleNames?: string[]
  ) {
    const scanner = new Scanner();
    const ruleObj = await scanner.getRulesFromFile(ruleType);
    if (ruleNames) {
      // handle this
    }
    cli.action.start('Scanning');
    const results = await scanner.scan(ruleObj, scope);
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
