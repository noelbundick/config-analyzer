import {TokenCredential} from '@azure/identity';
import {ResourceGraphClient} from '@azure/arm-resourcegraph';

import {ServiceClientCredentials, WebResource} from '@azure/ms-rest-js';

// Allows for use of @azure/identity credentials with the existing Azure management clients
export class AzureIdentityCredentialAdapter
  implements ServiceClientCredentials {
  cred: TokenCredential;

  constructor(cred: TokenCredential) {
    this.cred = cred;
  }

  public async signRequest(webResource: WebResource): Promise<WebResource> {
    const accessToken = await this.cred.getToken(
      'https://management.azure.com/'
    );
    if (!accessToken) {
      throw new Error(
        `Could not retrieve an access token for: ${webResource.url}`
      );
    }

    webResource.headers.set('Authorization', `Bearer ${accessToken.token}`);
    return webResource;
  }
}

// A friendly client for interacting with Azure resources
export class AzureClient {
  credential: TokenCredential;

  constructor(credential: TokenCredential) {
    this.credential = credential;
  }

  async queryResources(query: string, subscriptions: string[]) {
    const adapter = new AzureIdentityCredentialAdapter(this.credential);
    const client = new ResourceGraphClient(adapter);
    return await client.resources({
      query,
      subscriptions,
    });
  }
}
