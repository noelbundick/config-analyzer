import {DefaultAzureCredential} from '@azure/identity';
import * as env from 'env-var';
import {AzureIdentityCredentialAdapter} from '../../src/azure';
import {environment, IntegrationTestModes} from '../constants';

export const testRegion = 'westus2';
export const credential = new DefaultAzureCredential();
export const credentialAdapter = new AzureIdentityCredentialAdapter(credential);
export const blobStorageAccountName = 'azabhcf24jbcuxwo';

const integrationTestMode = env
  .get(environment.runIntegrationTests)
  .default(IntegrationTestModes.Disabled)
  .asEnum<IntegrationTestModes>(Object.values(IntegrationTestModes));

export const provisionIntegrationTests =
  integrationTestMode === IntegrationTestModes.Dynamic;

export const runIntegrationTests =
  integrationTestMode !== IntegrationTestModes.Disabled;

export const subscriptionId = env
  .get(environment.subscriptionId)
  .required(runIntegrationTests)
  .asString();

const defaultResourceGroup = `aza-${Date.now()}`;
export const resourceGroup = env
  .get(environment.resourceGroup)
  .default(defaultResourceGroup)
  .asString();
export const resourceGroup2 = env
  .get(environment.resourceGroup2)
  .default(defaultResourceGroup + '-2')
  .asString();

export const keyVaultId = env
  .get(environment.keyVaultId)
  .default('')
  .asString();

export const functionResourceGroup = `${resourceGroup}Functions`;
