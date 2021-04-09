# AZA Built in Rules

## Accidental Public Storage
name: "accidental-public-storage"
### Description 
Finds Storage Accounts with a Private Endpoint configured but the public endpoint is still enabled.  

By default, storage accounts accept connections from clients on any network. If a private endpoint is configured for the storage account, it may appear that the storage account is private and unable to be accessed outside of the subnet. However, the storage account's public endpoint is still accesible if the firewall rule is set to "Allow".

### How to Fix
"To secure your storage account, you should first configure a rule to deny access to traffic from all networks (including internet traffic) on the public endpoint, by default"  

See [Default Network Access Docs](https://docs.microsoft.com/en-us/azure/storage/common/storage-network-security?tabs=azure-portal#change-the-default-network-access-rule) for managing default network access rules. 

## Event Hubs Not Locked Down 1
name: "event-hubs-not-locked-down-1"
### Description 
Finds Event Hubs with a network rule set having zero IP and virtual network rules for the namespace.  

With most Azure services, when you enable the firewall - it disables all access except for the rules that you define. For Event Hubs, the service works differently - the default behavior is to allow all connections until you add the first rule, even if the default action is "Deny". Specifically, this can happen when enabling a private endpoint, and then turning on the firewall - thinking that you're blocking public access - when actually you're not

### How to Fix
"Specify at least one IP firewall rule or virtual network rule for the namespace to allow traffic only from the specified IP addresses or subnet of a virtual network. **If there are no IP and virtual network rules, the namespace can be accessed over the public internet (using the access key)**."  

See [Event Hubs - Allow access from IP addresses](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-ip-filtering) for adding IP firewall rules.   
See [Event Hubs - Allow access from VNETs](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-service-endpoints) for adding VNET firewall rules.  
See [Event Hubs - Allow access via Private Endpoints](https://docs.microsoft.com/en-us/azure/event-hubs/private-link-service) for adding firewall rules with Private Endpoints. 

## Event Hubs Not Locked Down 2
name: "event-hubs-not-locked-down-2"
### Description 
Finds Event Hubs with a network rule set having one or more IP and virtual network rules for the namespace but the defaultAction is not set to "Deny". 

### How to Fix
When adding virtual network or firewalls rules, set the value of defaultAction to Deny. 

See [Event Hubs - Allow IP Addresses - ARM Template](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-ip-filtering#use-resource-manager-template) for adding IP firewall rules and setting the defaultAction.   
See [Event Hubs - Allow VNETS - ARM Template](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-service-endpoints#use-resource-manager-template) for adding VNET firewall rules and setting the defaultAction.  