import {AzureIdentityCredentialAdapter} from '../../src/azure';
import {ResourceManagementClient} from '@azure/arm-resources';
import {DefaultAzureCredential} from '@azure/identity';
import * as env from 'env-var';
import {environment} from '../constants';

const sleep = (ms: number) => {
  return new Promise(callback => setTimeout(callback, ms));
};

let resourceClient: ResourceManagementClient;

const testRegion = 'westus2';
export const resourceGroup = `aza-${Date.now()}`;
export const credential = new DefaultAzureCredential();

const runIntegrationTests = env
  .get(environment.runIntegrationTests)
  .default('false')
  .asBoolStrict();

export const subscriptionId = env
  .get(environment.subscriptionId)
  .required(runIntegrationTests)
  .asString();

before(async function () {
  this.slow(60000);
  this.timeout(300000);

  if (!runIntegrationTests) {
    this.skip();
  }

  resourceClient = new ResourceManagementClient(
    new AzureIdentityCredentialAdapter(credential),
    subscriptionId
  );

  await resourceClient.resourceGroups.createOrUpdate(resourceGroup, {
    location: testRegion,
  });
  await resourceClient.deployments.createOrUpdate(
    resourceGroup,
    resourceGroup,
    {
      properties: {
        mode: 'Incremental',
        template: require('../templates/azuredeploy.json'),
      },
    }
  );
  await sleep(5000);
});

after(async () => {
  if (!runIntegrationTests) {
    return;
  }

  await resourceClient.resourceGroups.beginDeleteMethod(resourceGroup);
});
