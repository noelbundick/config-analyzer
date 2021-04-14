import {expect} from 'chai';
import {ARMTemplateRule, RuleType} from '../../../src/rules';
import {
  credential,
  resourceGroup,
  resourceGroup2,
  runIntegrationTests,
  subscriptionId,
} from '..';
import {ScanResult} from '../../../src/scanner';

describe('ARM Template Rule', function () {
  this.slow(60000);
  this.timeout(300000);

  before(function () {
    if (!runIntegrationTests) {
      this.skip();
    }
  });

  it('can get an execute an accidental storage rule scoped to a Resource Group', async () => {
    const rule = new ARMTemplateRule({
      name: 'accidental-public-storage',
      description:
        'Finds Storage Accounts with a Private Endpoint configured but the public endpoint is still enabled',
      type: RuleType.ARM,
      evaluation: {
        query:
          'type == `Microsoft.Storage/storageAccounts` && properties.networkAcls.defaultAction == `Allow`',
        and: [
          {
            query:
              'type == `Microsoft.Storage/storageAccounts/privateEndpointConnections` && starts_with(name, `{{parent.name}}/`)',
          },
        ],
      },
    });
    const target = await ARMTemplateRule.getTarget(
      subscriptionId,
      resourceGroup,
      credential
    );
    // TODO: clean this up to not have hard coded values
    // this can happen when we refactor the test ARM Temlplate
    const storageAccountName = 'azabhcf24jbcuxwo';
    const expectedResult = {
      ruleName: rule.name,
      description: rule.description,
      total: 1,
      resourceIds: [
        `subscriptions/${target.subscriptionId}/resourceGroups/${target.groupName}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}`,
      ],
    };
    const result = await rule.execute(target);
    expect(result).to.deep.equal(expectedResult);
  });
  it('tests the function app misconfiguration with the RequestEvaluation', async () => {
    const target = await ARMTemplateRule.getTarget(
      subscriptionId,
      resourceGroup2,
      credential
    );
    const rule = new ARMTemplateRule({
      name: 'function-app-vnet-integration-misconfiguration',
      description: '',
      type: RuleType.ARM,
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#event-hubs-not-locked-down-1',
      evaluation: {
        query: 'type == `Microsoft.Web/sites`',
        request: {
          operation: 'config/appsettings/list',
          query:
            "properties.WEBSITE_DNS_SERVER != '168.63.129.16' || properties.WEBSITE_VNET_ROUTE_ALL != '1'",
        },
        and: [
          {
            query:
              'type == `Microsoft.Web/sites/virtualNetworkConnections` && starts_with(name, `{{parent.name}}/`)',
          },
        ],
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      recommendation: rule.recommendation,
      total: 1,
      resourceIds: [
        `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup2}/providers/Microsoft.Web/sites/azamisconfigfunc`,
      ],
    };
    const resultShouldPass = await rule.execute(target);
    expect(resultShouldPass).to.deep.equal(expectedResult, 'failing');
  });
  it('tests the Event Hub is not locked down rule 1', async () => {
    const target = await ARMTemplateRule.getTarget(
      subscriptionId,
      resourceGroup,
      credential
    );
    const rule = new ARMTemplateRule({
      name: 'event-hubs-not-locked-down-1',
      description: '',
      type: 'ARM' as RuleType.ARM,
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#event-hubs-not-locked-down-1',
      evaluation: {
        query:
          'type == `Microsoft.EventHub/namespaces/networkRuleSets` && properties.defaultAction == `Deny` && length(properties.ipRules) == `0` && length(properties.virtualNetworkRules) == `0`',
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      recommendation: rule.recommendation,
      total: 1,
      resourceIds: [
        `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/networkRuleSets/misconfigRule1/default`,
      ],
    };
    const result = await rule.execute(target);
    expect(result).to.deep.equal(expectedResult);
  });
  it('tests the Event Hub is not locked down rule 2', async () => {
    const target = await ARMTemplateRule.getTarget(
      subscriptionId,
      resourceGroup,
      credential
    );
    const rule = new ARMTemplateRule({
      name: 'event-hubs-not-locked-down-2',
      description: '',
      type: 'ARM' as RuleType.ARM,
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#event-hubs-not-locked-down-2',
      evaluation: {
        query:
          'type == `Microsoft.EventHub/namespaces/networkRuleSets` && properties.defaultAction == `Allow` && (length(properties.ipRules) > `0` || length(properties.virtualNetworkRules) > `0`)',
      },
    });
    const expectedResult: ScanResult = {
      ruleName: rule.name,
      description: rule.description,
      recommendation: rule.recommendation,
      total: 1,
      resourceIds: [
        `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/networkRuleSets/misconfigRule2/default`,
      ],
    };
    const result = await rule.execute(target);
    expect(result).to.deep.equal(expectedResult);
  });
});
