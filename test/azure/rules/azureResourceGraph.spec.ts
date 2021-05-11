import {expect} from 'chai';
import {
  isRequestEvaluation,
  Request,
  ResourceGraphRule,
  ResourceGraphTarget,
  RuleType,
} from '../../../src/rules';
import {
  credential,
  resourceGroup,
  resourceGroup2,
  runIntegrationTests,
  subscriptionId,
} from '..';
import {DefaultAzureCredential} from '@azure/identity';

describe('Resource Graph Rule', function () {
  this.slow(6000);
  this.timeout(15000);

  before(function () {
    if (!runIntegrationTests) {
      this.skip();
    }
  });

  const testRule = new ResourceGraphRule({
    name: 'test-rule',
    evaluation: {
      query: "Resources | where type=~ 'Microsoft.EventHub/namespaces'",
      request: [
        {
          operation: 'networkRuleSets/default',
          httpMethod: 'GET',
          query:
            'properties.defaultAction == `Deny` && length(properties.ipRules) == `0` && length(properties.virtualNetworkRules) == `0`',
        },
      ],
    },
    recommendation: 'recommendationLink',
    description: 'Test Rule',
    type: RuleType.ResourceGraph,
  });

  const testTarget: ResourceGraphTarget = {
    credential: new DefaultAzureCredential(),
    subscriptionIds: [subscriptionId],
    type: RuleType.ResourceGraph,
  };

  it('can execute a resource graph rule and return a scan result', async () => {
    const rule = new ResourceGraphRule({
      name: 'test-rule',
      description: 'Intentional bad query',
      evaluation: {
        query: "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'",
      },
      type: RuleType.ResourceGraph,
      recommendation: 'someLink',
    });
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionIds: [subscriptionId],
      credential,
    };
    const result = await rule.execute(target);
    expect(result).to.deep.equal({
      ruleName: rule.name,
      description: rule.description,
      recommendation: rule.recommendation,
      total: 0,
      resourceIds: [],
    });
  });
  it('should return any non existing resource groups in a subscription', async () => {
    const nonExistingGroup1 = `i-should-not-exist-${Date.now()}-1`;
    const nonExistingGroup2 = `i-should-not-exist-${Date.now()}-2`;
    const groupNames = [
      nonExistingGroup1,
      nonExistingGroup2,
      resourceGroup,
      resourceGroup2,
    ];
    const target: ResourceGraphTarget = {
      type: RuleType.ResourceGraph,
      subscriptionIds: [subscriptionId],
      credential,
      groupNames,
    };
    const nonExistingGroups = await ResourceGraphRule.getNonExistingResourceGroups(
      target
    );
    expect(nonExistingGroups).to.contain(nonExistingGroup1);
    expect(nonExistingGroups).to.contain(nonExistingGroup2);
    expect(nonExistingGroups).to.not.contain(resourceGroup);
    expect(nonExistingGroups).to.not.contain(resourceGroup2);
  });

  it('can send a http request with a target and resource Id', async () => {
    if (!isRequestEvaluation(testRule.evaluation)) {
      throw Error('Invalid request evalaution');
    }
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const result = await testRule.sendRequest(
      testTarget,
      resourceId,
      testRule.evaluation.request[0] as Request
    );
    expect(result.parsedBody.properties).to.include.keys([
      'defaultAction',
      'ipRules',
      'virtualNetworkRules',
    ]);
  });

  it('can get the default api version for a resource type', async () => {
    // the default api version may change, so probably not the best test. Is there another way we can test this?
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = await testRule.getDefaultApiVersion(resourceId, client);
    expect(apiVersion).to.equal('2017-04-01');
  });

  it('can get a Request Url with a provided api version', async () => {
    if (!isRequestEvaluation(testRule.evaluation)) {
      throw Error('Invalid request evalaution');
    }
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = '2018-01-01-preview';
    const url = await testRule.getRequestUrl(
      resourceId,
      client,
      testRule.evaluation.request[0] as Request,
      apiVersion
    );
    if (isRequestEvaluation(testRule.evaluation)) {
      expect(url).to.equal(
        `https://management.azure.com/${resourceId}/${testRule.evaluation.request[0].operation}?api-version=${apiVersion}`
      );
    }
  });

  it('can get a Request Url when an api version is not provided', async () => {
    if (!isRequestEvaluation(testRule.evaluation)) {
      throw Error('Invalid request evalaution');
    }
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = await testRule.getDefaultApiVersion(resourceId, client);
    const url = await testRule.getRequestUrl(
      resourceId,
      client,
      testRule.evaluation.request[0] as Request
    );
    if (isRequestEvaluation(testRule.evaluation)) {
      expect(url).to.equal(
        `https://management.azure.com/${resourceId}/${testRule.evaluation.request[0].operation}?api-version=${apiVersion}`
      );
    } else {
      throw Error('The test rule is not a request evaluation');
    }
  });

  it('tests the Event Hub is not locked down rule 1', async () => {
    const rule = new ResourceGraphRule({
      name: 'event-hubs-not-locked-down-1',
      description:
        'Finds Event Hubs with a network rule set having zero IP and virtual network rules and the defaultAction is Deny.',
      type: RuleType.ResourceGraph,
      evaluation: {
        query: "Resources | where type=~ 'Microsoft.EventHub/namespaces'",
        request: [
          {
            operation: 'networkRuleSets/default',
            httpMethod: 'GET',
            query:
              'properties.defaultAction == `Deny` && length(properties.ipRules) == `0` && length(properties.virtualNetworkRules) == `0`',
          },
        ],
      },
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#event-hubs-not-locked-down-1',
    });
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const shouldNotFindResourceId1 = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/azaTestNamespace`;
    const shouldNotFindResourceId2 = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule2`;
    const result = await rule.execute(testTarget);
    expect(result.resourceIds).to.include(resourceId);
    expect(result.resourceIds).to.not.include(shouldNotFindResourceId1);
    expect(result.resourceIds).to.not.include(shouldNotFindResourceId2);
  });

  it('tests the Event Hub is not locked down rule 2', async () => {
    const rule = new ResourceGraphRule({
      name: 'event-hubs-not-locked-down-1',
      description:
        "Finds Event Hubs with a network rule set having one or more IP and virtual network rules for the namespace but the defaultAction is not set to 'Deny'",
      type: RuleType.ResourceGraph,
      evaluation: {
        query: "Resources | where type=~ 'Microsoft.EventHub/namespaces'",
        request: [
          {
            operation: 'networkRuleSets/default',
            httpMethod: 'GET',
            query:
              'properties.defaultAction == `Allow` && (length(properties.ipRules) > `0` || length(properties.virtualNetworkRules) > `0`)',
          },
        ],
      },
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#event-hubs-not-locked-down-2',
    });
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule2`;
    const shouldNotFindResourceId1 = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/azaTestNamespace`;
    const shouldNotFindResourceId2 = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const result = await rule.execute(testTarget);
    expect(result.resourceIds).to.include(resourceId);
    expect(result.resourceIds).to.not.include(shouldNotFindResourceId1);
    expect(result.resourceIds).to.not.include(shouldNotFindResourceId2);
  });

  it('tests the Function app rule', async () => {
    const rule = new ResourceGraphRule({
      name: 'function-app-vnet-integration-misconfiguration',
      description:
        'Finds Function Apps integrated with a VNET but the app settings are not properly configured',
      type: RuleType.ResourceGraph,
      recommendation:
        'https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#function-app-vnet-integration-misconfiguration',
      evaluation: {
        query:
          "Resources | where type =~ 'Microsoft.Web/sites' and kind =~ 'functionapp'",
        request: [
          {
            operation: 'virtualNetworkConnections',
            httpMethod: 'GET',
            query: 'exists',
          },
          {
            operation: 'config/appsettings/list',
            httpMethod: 'POST',
            query:
              "properties.WEBSITE_DNS_SERVER != '168.63.129.16' || properties.WEBSITE_VNET_ROUTE_ALL != '1'",
          },
        ],
      },
    });
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup2}/providers/Microsoft.Web/sites/azamisconfigfunc`;
    const shouldNotFindResourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup2}/providers/Microsoft.Web/sites/azagoodfunc`;
    const result = await rule.execute(testTarget);
    expect(result.resourceIds).to.include(resourceId);
    expect(result.resourceIds).to.not.include(shouldNotFindResourceId);
  });
});
