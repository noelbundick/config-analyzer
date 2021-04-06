# AZA Built in Rules

## Accidental Public Storage
"accidental-public-storage"
#### description 
Finds Storage Accounts with a Private Endpoint configured but the public endpoint is still enabled.  

By default, storage accounts accept connections from clients on any network. If a private endpoint is configured for the storage account, it may appear that the storage account is private and unable to be accessed outside of the subnet. However, the storage account's public endpoint is still accesible if the firewall rule is set to "Allow".

### How to Fix
"To secure your storage account, you should first configure a rule to deny access to traffic from all networks (including internet traffic) on the public endpoint, by default"
See link below for managing default network access rules.  
[Azure Documentation] (https://docs.microsoft.com/en-us/azure/storage/common/storage-network-security?tabs=azure-portal#change-the-default-network-access-rule)