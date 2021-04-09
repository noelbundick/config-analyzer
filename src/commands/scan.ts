import {Command, flags} from '@oclif/command';
import {Scanner, ScanResult} from '../scanner';
import {Target, RuleType, ResourceGraphRule, ARMTemplateRule} from '../rules';
import {format, LogOptions} from '../commandHelper';
import cli from 'cli-ux';
import {DefaultAzureCredential} from '@azure/identity';

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
      multiple: true,
    }),
    group: flags.string({
      char: 'g',
      description: 'Azure resource groups to scan',
      multiple: true,
      dependsOn: ['scope'],
    }),
    template: flags.boolean({
      char: 't',
      description: 'runs rules against an exported ARM template',
      dependsOn: ['scope'],
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
    if (flags.template) {
      if (flags.scope.length > 1) {
        this.error('Please provide only one subscription');
      }
      if (!flags.group || flags.group.length > 1) {
        this.error('Please provide one resource group to scan');
      }
      cli.action.start('Fetching template. This may take a few moments');
      const template = await ARMTemplateRule.getTemplate(
        flags.scope[0],
        flags.group[0],
        new DefaultAzureCredential()
      );
      cli.action.stop();
      target = {
        type: RuleType.ARM,
        subscriptionId: flags.scope[0],
        groupName: flags.group[0],
        template: template._response.parsedBody.template,
      };
    } else if (flags.scope) {
      if (flags.scope.length > 1 && flags.group) {
        this.error(
          'Only one subscription can be scanned when using Flag --group'
        );
      }
      target = {
        type: RuleType.ResourceGraph,
        subscriptionIds: flags.scope,
        groupNames: flags.group,
        credential: new DefaultAzureCredential(),
      };
      if (flags.group) {
        const nonExistingGroups = await ResourceGraphRule.getNonExistingResourceGroups(
          target
        );
        for (const g of nonExistingGroups) {
          this.warn(
            `Resource Group '${g}' does not exist in this subscription`
          );
        }
      }
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
