import {flags} from '@oclif/command';
import Scan from './index';
import {ARMTemplateRule} from '../../rules';
import cli from 'cli-ux';
import {DefaultAzureCredential} from '@azure/identity';

export default class ScanARM extends Scan {
  static description =
    'Scans exported ARM Templates for potential configuration issues';

  static examples = [
    `$ azca scan:arm --subscription <subscriptionId> --group <resourceGroupName>
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
    ...Scan.flags,
    subscription: flags.string({
      char: 's',
      description: 'Azure subscription id to scan',
    }),
    group: flags.string({
      char: 'g',
      description: 'Azure resource groups to scan',
      dependsOn: ['subscription'],
    }),
  };

  async run() {
    const {flags} = this.parse(ScanARM);
    if (flags.verbose) this.isVerbose = true;
    if (flags.debug) this.isDebugMode = true;
    if (!flags.subscription || !flags.group) {
      this.error(
        'Command scan:arm expects one --subscription and at least one --group'
      );
    } else {
      cli.action.start('Fetching template. This may take a few moments');
      const target = await ARMTemplateRule.getTarget(
        flags.subscription,
        flags.group,
        new DefaultAzureCredential()
      );
      cli.action.stop();
      await this.scan(target, flags.file);
    }
  }
}
