import {flags} from '@oclif/command';
import Scan from './index';
import {TerraformRule, TerraformTarget} from '../../rules';
import cli from 'cli-ux';

export default class ScanARM extends Scan {
  static description =
    'Scans Terrform JSON plan file for potential configuration issues';

  static examples = [
    `$ azca scan:tf --plan <terraformJsonPlanFilePath> 
    [rule-name]
        [✓ | ❌][rule-description]     
        Resources:
                [resource-address]

    [total-passing]
    [total-failing]
    [total-rules-scanned]   
`,
  ];

  static flags = {
    ...Scan.flags,
    plan: flags.string({
      char: 'p',
      description: 'JSON terraform plan file to evaluate',
    }),
  };

  async run() {
    const {flags} = this.parse(ScanARM);
    if (flags.verbose) this.isVerbose = true;
    if (flags.debug) this.isDebugMode = true;
    if (!flags.plan) {
      this.error('Command scan:tf expects one JSON terraform plan file');
    } else {
      cli.action.start('Reading file');
      const target: TerraformTarget = await TerraformRule.getTarget(flags.plan);
      cli.action.stop();
      await this.scan(target, flags.file);
    }
  }
}
