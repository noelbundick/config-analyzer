import {ResourceManagementClient} from '@azure/arm-resources';
import {AzureIdentityCredentialAdapter} from '../../src/azure';
import {
  credential,
  resourceGroup,
  resourceGroup2,
  subscriptionId,
  testRegion,
  keyVaultId,
  blobStorageAccountName,
  functionResourceGroup,
} from '.';

export async function provisionEnvironment() {
  await provisionFunctionAppEnvironment();
  const resourceClient = new ResourceManagementClient(
    new AzureIdentityCredentialAdapter(credential),
    subscriptionId
  );

  await resourceClient.resourceGroups.createOrUpdate(resourceGroup, {
    location: testRegion,
  });
  await resourceClient.resourceGroups.createOrUpdate(resourceGroup2, {
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
          resourceGroup2: {
            value: resourceGroup2,
          },
          location: {
            value: testRegion,
          },
          blobStorageAccountName: {
            value: blobStorageAccountName,
          },
          adminPasswordOrKey: {
            reference: {
              keyVault: {
                id: keyVaultId,
              },
              secretName: 'DefaultAdminPasswordSecret',
            },
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
  await resourceClient.resourceGroups.beginDeleteMethod(functionResourceGroup);
}

export async function provisionFunctionAppEnvironment() {
  const resourceClient = new ResourceManagementClient(
    new AzureIdentityCredentialAdapter(credential),
    subscriptionId
  );

  await resourceClient.resourceGroups.createOrUpdate(functionResourceGroup, {
    location: testRegion,
  });
  await resourceClient.deployments.createOrUpdate(
    functionResourceGroup,
    functionResourceGroup,
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

async function main() {
  const args = process.argv.slice(2);
  switch (args[0]) {
    case 'provision':
      await provisionEnvironment();
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
