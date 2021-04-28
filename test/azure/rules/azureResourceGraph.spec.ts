import {expect} from 'chai';
import {
  isRequestEvaluation,
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
  this.timeout(10000);

  before(function () {
    if (!runIntegrationTests) {
      this.skip();
    }
  });

  const testRule = new ResourceGraphRule({
    name: 'test-rule',
    evaluation: {
      query: "Resources | where type=~ 'Microsoft.EventHub/namespaces'",
      request: {
        operation: 'networkRuleSets/default',
        query:
          'properties.defaultAction == `Deny` && length(properties.ipRules) == `0` && length(properties.virtualNetworkRules) == `0`',
      },
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
    const resourceId = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const result = await testRule.sendRequest(testTarget, resourceId);
    expect(result.parsedBody.properties).to.include.keys([
      'defaultAction',
      'ipRules',
      'virtualNetworkRules',
    ]);
  });

  it('can get the latest api version for a resource type', async () => {
    const resourceId = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = await testRule.getLatestApiVersion(resourceId, client);
    expect(apiVersion).to.equal('2021-01-01-preview');
  });

  it('can get a valid api version from a HttpOperationResponse error response', async () => {
    const errorMessage =
      "No registered resource provider found for location 'eastus2' and API version '1' for type 'namespaces'. The supported api-versions are '2014-09-01, 2015-08-01, 2017-04-01, 2018-01-01-preview, 2021-01-01-preview'. The supported locations are 'australiaeast, australiasoutheast, centralus, eastus, eastus2, westus, westus2, northcentralus, southcentralus, westcentralus, eastasia, southeastasia, brazilsouth, japaneast, japanwest, northeurope, westeurope, centralindia, southindia, westindia, canadacentral, canadaeast, ukwest, uksouth, koreacentral, koreasouth, francecentral, southafricanorth, uaenorth, australiacentral, switzerlandnorth, germanywestcentral, norwayeast, jioindiawest'.";
    const apiVersions = await testRule.getApiVersionFromError(errorMessage);
    expect(apiVersions).to.equal('2018-01-01-preview');
  });

  it('throws an error when it cannot retrive a valid api version', async () => {
    const errorMessage =
      "No registered resource provider found for location 'eastus2' and API version '2020-02-01' for type 'namespaces'. The supported api-versions are ', , , ,'. The supported locations are 'australiaeast, australiasoutheast, centralus, eastus, eastus2, westus, westus2, northcentralus, southcentralus, westcentralus, eastasia, southeastasia, brazilsouth, japaneast, japanwest, northeurope, westeurope, centralindia, southindia, westindia, canadacentral, canadaeast, ukwest, uksouth, koreacentral, koreasouth, francecentral, southafricanorth, uaenorth, australiacentral, switzerlandnorth, germanywestcentral, norwayeast, jioindiawest'.";
    const iThrowError = () => testRule.getApiVersionFromError(errorMessage);
    expect(iThrowError).throw(Error, 'Unable to find a valid apiVersion');
  });

  it('can getElementFromId', () => {
    const resourceId = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const subscription = testRule.getElementFromId('subscription', resourceId);
    const provider = testRule.getElementFromId('provider', resourceId);
    const resourceType = testRule.getElementFromId('resourceType', resourceId);
    expect(subscription).to.equal(subscriptionId);
    expect(provider).to.equal('Microsoft.EventHub');
    expect(resourceType).to.equal('namespaces');
  });

  it('can get a Request Url with a provided apiVersion', async () => {
    const resourceId = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = '2018-01-01-preview';
    const url = await testRule.getRequestUrl(resourceId, client, apiVersion);
    if (isRequestEvaluation(testRule.evaluation)) {
      expect(url).to.equal(
        `https://management.azure.com/${resourceId}/${testRule.evaluation.request.operation}?api-version=${apiVersion}`
      );
    }
  });

  it('can get a Request Url when an apiVersion is not provided', async () => {
    const resourceId = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventHub/namespaces/misconfigRule1`;
    const client = await testRule.getResourceManagmentClient(resourceId);
    const apiVersion = await testRule.getLatestApiVersion(resourceId, client);
    const url = await testRule.getRequestUrl(resourceId, client);
    if (isRequestEvaluation(testRule.evaluation)) {
      expect(url).to.equal(
        `https://management.azure.com/${resourceId}/${testRule.evaluation.request.operation}?api-version=${apiVersion}`
      );
    }
  });
});
