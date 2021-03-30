import {ResourceManagementClient} from '@azure/arm-resources';
import {AzureIdentityCredentialAdapter} from '../../src/azure';
import {
  credential,
  resourceGroup,
  resourceGroup2,
  subscriptionId,
  testRegion,
  keyVaultId,
} from '.';

export async function provisionEnvironment() {
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
  main().then();
}
