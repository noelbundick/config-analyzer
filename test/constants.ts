// Environment variables that are used by the test suite
export const environment = {
  resourceGroup: 'AZA_TEST_RESOURCE_GROUP',
  resourceGroup2: 'AZA_TEST_RESOURCE_GROUP_2',
  subscriptionId: 'AZA_TEST_SUBSCRIPTION_ID',
  runIntegrationTests: 'AZA_TEST_INTEGRATION',
  keyVaultId: 'AZA_TEST_KEY_VAULT_ID',
};

// How to run the integration tests
export enum IntegrationTestModes {
  Dynamic = 'dynamic', // Create new Azure infrastructure on each run
  Static = 'static', // Run tests against a precreated infrastructure
  Disabled = 'disabled', // Do not run integration tests
}
