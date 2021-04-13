import {ResourceManagementClient} from '@azure/arm-resources';
import {AzureIdentityCredentialAdapter} from '../../src/azure';
import {
  credential,
  resourceGroup,
  resourceGroup2,
  subscriptionId,
  testRegion,
  vmPassword,
  blobStorageAccountName,
} from '.';

function getClient() {
  return new ResourceManagementClient(
    new AzureIdentityCredentialAdapter(credential),
    subscriptionId
  );
}

export async function provisionEnvironment() {
  await provisionStorageEnvironment();
  await provisionFunctionAppEnvironment();
  await provisionEventHubEnvironment();
}

export async function provisionStorageEnvironment() {
  const resourceClient = getClient();

  await resourceClient.resourceGroups.createOrUpdate(resourceGroup, {
    location: testRegion,
  });

  await resourceClient.deployments.createOrUpdate(
    resourceGroup,
    resourceGroup,
    {
      properties: {
        mode: 'Incremental',
        template: require('./templates/azuredeploy.json'),
        parameters: {
          location: {
            value: testRegion,
          },
          blobStorageAccountName: {
            value: blobStorageAccountName,
          },
          adminPasswordOrKey: {
            value: vmPassword,
          },
        },
      },
    }
  );
}

export async function provisionFunctionAppEnvironment() {
  const resourceClient = getClient();

  await resourceClient.resourceGroups.createOrUpdate(resourceGroup2, {
    location: testRegion,
  });
  await resourceClient.deployments.createOrUpdate(
    resourceGroup2,
    `${resourceGroup}Functions`,
    {
      properties: {
        mode: 'Incremental',
        template: require('./templates/azuredeploy-function-app.json'),
        parameters: {
          location: {
            value: testRegion,
          },
        },
      },
    }
  );
}

export async function provisionEventHubEnvironment() {
  const resourceClient = getClient();

  await resourceClient.resourceGroups.createOrUpdate(resourceGroup, {
    location: testRegion,
  });
  await resourceClient.deployments.createOrUpdate(
    resourceGroup,
    `${resourceGroup}EventHub`,
    {
      properties: {
        mode: 'Incremental',
        template: require('./templates/azuredeploy-event-hubs.json'),
        parameters: {
          location: {
            value: testRegion,
          },
        },
      },
    }
  );
}

export async function teardownEnvironment() {
  const resourceClient = new ResourceManagementClient(
    new AzureIdentityCredentialAdapter(credential),
    subscriptionId
  );
  await resourceClient.resourceGroups.beginDeleteMethod(resourceGroup);
  await resourceClient.resourceGroups.beginDeleteMethod(resourceGroup2);
}

async function main() {
  const args = process.argv.slice(2);
  switch (args[0]) {
    case 'provision':
      await provisionEnvironment();
      break;
    case 'provisionFunctions':
      await provisionFunctionAppEnvironment();
      break;
    case 'provisionStorage':
      await provisionStorageEnvironment();
      break;
    case 'provisionEventHubs':
      await provisionEventHubEnvironment();
      break;
    case 'teardown':
      await teardownEnvironment();
      break;
    default:
      throw new Error('unknown operation');
  }
}

if (require.main === module) {
  //TODO: console.log() info re: resourceGroup/etc.
  main().then();
}
