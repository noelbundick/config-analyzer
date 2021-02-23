import {AzureClient, AzureIdentityCredentialAdapter} from '../src/azure';
import {assert} from 'chai';
import {ResourceManagementClient} from '@azure/arm-resources';
import {DefaultAzureCredential} from '@azure/identity';
import * as env from 'env-var';
import {environment} from './constants';

const sleep = (ms: number) => {
  return new Promise(callback => setTimeout(callback, ms));
};

describe('Resource Graph client', function () {
  this.slow(3000);
  this.timeout(5000);

  const runIntegrationTests = env.get(environment.runIntegrationTests).asBool();
  const subscriptionId = env
    .get(environment.subscriptionId)
    .required(runIntegrationTests)
    .asString();

  const resourceGroup = `aza-${Date.now()}`;
  const testRegion = 'westus2';

  const credential = new DefaultAzureCredential();
  const adapter = new AzureIdentityCredentialAdapter(credential);
  const resources = new ResourceManagementClient(adapter, subscriptionId);

  before(async function () {
    this.slow(60000);
    this.timeout(300000);

    if (!runIntegrationTests) {
      this.skip();
    }

    await resources.resourceGroups.createOrUpdate(resourceGroup, {
      location: testRegion,
    });
    await resources.deployments.createOrUpdate(resourceGroup, resourceGroup, {
      properties: {
        mode: 'Incremental',
        template: require('./templates/azuredeploy.json'),
      },
    });
    await sleep(5000);
  });

  after(async () => {
    if (!runIntegrationTests) {
      return;
    }

    await resources.resourceGroups.beginDeleteMethod(resourceGroup);
  });

  it('can execute queries', async () => {
    const client = new AzureClient(credential);
    const query = `resources | where resourceGroup == "${resourceGroup}"`;
    const resources = await client.queryResources(query, [subscriptionId]);
    assert.isNotNull(resources);
    assert.isAtLeast(resources.count, 1);
  });
});
