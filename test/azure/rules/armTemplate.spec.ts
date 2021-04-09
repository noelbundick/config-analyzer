import {expect} from 'chai';
import {ARMTemplateRule, RuleType} from '../../../src/rules';
import {credential, resourceGroup, subscriptionId} from '..';

describe('ARM Template Rule', function () {
  this.slow(15000);
  this.timeout(20000);
  it('can get an execute an accidental storage rule scoped to a Resource Group', async () => {
    const rule = new ARMTemplateRule({
      name: 'accidental-public-storage',
      description:
        'Finds Storage Accounts with a Private Endpoint configured but the public endpoint is still enabled',
      type: 'ARM' as RuleType.ARM,
      evaluation: {
        query:
          'type == `Microsoft.Storage/storageAccounts` && properties.networkAcls.defaultAction == `Deny`',
        and: [
          {
            query:
              'type == `Microsoft.Storage/storageAccounts/privateEndpointConnections` && starts_with(name, `{{parent.name}}/`)',
          },
        ],
      },
    });
    const template = await ARMTemplateRule.getTemplate(
      subscriptionId,
      resourceGroup,
      credential
    );
    const target = {
      type: 'ARM' as RuleType.ARM,
      subscriptionId: subscriptionId,
      groupName: resourceGroup,
      template: template._response.parsedBody.template,
    };
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
    const result = rule.execute(target);
    expect(result).to.deep.equal(expectedResult);
  });
});
