import {flags} from '@oclif/command';
import Scan from './index';
import {RuleType, ResourceGraphRule, ResourceGraphTarget} from '../../rules';
import {DefaultAzureCredential} from '@azure/identity';
import {cli} from 'cli-ux';

export default class ScanResourceGraph extends Scan {
  static description =
    'Uses Resource Graph queries to scan Azure resources for potential configuration issues';

  static examples = [
    `$ azca scan:rg --subscription <subscriptionId>
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
      required: true,
      multiple: true,
    }),
    group: flags.string({
      char: 'g',
      description: 'Azure resource groups to scan',
      multiple: true,
      dependsOn: ['subscription'],
    }),
  };

  async run() {
    const {flags} = this.parse(ScanResourceGraph);
    if (flags.verbose) this.isVerbose = true;
    if (flags.debug) this.isDebugMode = true;
    if (flags.subscription.length > 1 && flags.group) {
      this.error(
        'Only one subscription can be scanned when using Flag --group'
      );
    }
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionIds: flags.subscription,
      groupNames: flags.group,
      credential: new DefaultAzureCredential(),
    };
    if (flags.group) {
      cli.action.start('Validating Resource Groups');
      const nonExistingGroups = await ResourceGraphRule.getNonExistingResourceGroups(
        target
      );
      cli.action.stop();
      for (const g of nonExistingGroups) {
        this.warn(`Resource Group '${g}' does not exist in this subscription`);
      }
    }
    this.scan(target, flags.file);
  }
}
