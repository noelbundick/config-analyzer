import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../scanner';

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
  };

  private _displayResult(r: ScanResult) {
    this.log('Name: ' + r.ruleName);
    this.log('Description: ' + r.description);
    this.log('Total: ' + r.total);
    this.log('Resource Ids: ' + r.ids);
  }

  async catch(err: any) {
    console.log(err);
    throw err;
  }

  async run() {
    const {flags} = this.parse(Scan);

    if (flags.scope) {
      const scanner = new Scanner();
      const results = await scanner.scan(
        'resourceGraph',
        flags.scope,
        flags.rule
      );
      results.forEach(r => this._displayResult(r));
    } else {
      this.error('Command scan expects a --scope Flag');
    }
  }
}
