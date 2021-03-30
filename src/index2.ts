export type ARMResource = EventHubNetworkRuleSet | Storage;

interface ARMResourceBase {
  apiVersion: string;
  name: string;
  type: string;
}

export interface EventHubNetworkRuleSet extends ARMResourceBase {
  type: 'Microsoft.EventHub/namespaces/networkRuleSets';
  dependsOn: string[];
  properties: {
    virtualNetworkRules: [];
    ipRules: [];
    trustedServiceAccessEnabled?: boolean;
    defaultAction: string;
  };
}

interface Storage extends ARMResourceBase {
  type: 'Microsoft.Storage/storageAccounts';
  sku: {
    name: string;
    tier: string;
  };
  kind: string;
  location: string;
  tags: {};
  identity: {};
  properties: {
    customDomain: {
      name: string;
      useSubDomainName: boolean;
    };
    encryption: {
      services: {
        blob: {
          enabled: boolean;
          keyType: string;
        };
        file: {
          enabled: boolean;
          keyType: string;
        };
        table: {
          enabled: boolean;
          keyType: string;
        };
        queue: {
          enabled: boolean;
          keyType: string;
        };
      };
      keySource: string;
      requireInfrastructureEncryption: boolean;
      keyvaultproperties: {
        keyname: string;
        keyversion: string;
        keyvaulturi: string;
      };
    };
    networkAcls: {
      bypass: string;
      virtualNetworkRules: [];
      ipRules: [];
      defaultAction: string;
    };
    accessTier: string;
    azureFilesIdentityBasedAuthentication: {
      directoryServiceOptions: string;
      activeDirectoryProperties: {
        domainName: string;
        netBiosDomainName: string;
        forestName: string;
        domainGuid: string;
        domainSid: string;
        azureStorageSid: string;
      };
    };
    supportsHttpsTrafficOnly: boolean;
    isHnsEnabled: boolean;
    largeFileSharesState: string;
    routingPreference: {
      routingChoice: string;
      publishMicrosoftEndpoints: boolean;
      publishInternetEndpoints: boolean;
    };
    allowBlobPublicAccess: boolean;
    minimumTlsVersion: string;
  };
  resources: [];
}
