import {AzureClient} from '../../src/azure';
import {assert} from 'chai';
import {
  credential,
  resourceGroup,
  runIntegrationTests,
  subscriptionId,
} from '.';

describe('Resource Graph client', function () {
  this.slow(3000);
  this.timeout(5000);

  before(function () {
    if (!runIntegrationTests) {
      this.skip();
    }
  });

  it('can execute queries', async () => {
    const client = new AzureClient(credential);
    const query = `resources | where resourceGroup == "${resourceGroup}"`;
    const resources = await client.queryResources(query, [subscriptionId]);
    assert.isNotNull(resources);
    assert.isAtLeast(resources.count, 1);
  });
});
