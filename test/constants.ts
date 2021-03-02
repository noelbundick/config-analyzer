// Environment variables that are used by the test suite
export const environment = {
  resourceGroup: 'AZA_TEST_RESOURCE_GROUP',
  subscriptionId: 'AZA_TEST_SUBSCRIPTION_ID',
  runIntegrationTests: 'AZA_TEST_INTEGRATION',
};

// How to run the integration tests
export enum IntegrationTestModes {
  Dynamic = 'dynamic', // Create new Azure infrastructure on each run
  Static = 'static', // Run tests against a precreated infrastructure
  Disabled = 'disabled', // Do not run integration tests
}
