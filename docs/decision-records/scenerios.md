# AZA - Scenarios

## What is it?
A CLI application that can scan Azure Resources for configuration issues.

## Behavior
* It should return resources that break a condition along with documentation on how to fix it.    
* A user should be able to author their own rules for supported scenarios.  
* Rules should support multiple evaluations on a single resource.
* Rule should support evaluations across multiple resources
* Evaluations should be able to nested so that a child evaluation can access properties on the returned resources from the parent evalutation 


## Scenarios

### ARM Templates 
* Evaluations should be able to nested so that a child evaluation can access properties on the returned resources from their parent evalutation 

#### Exported ARM Templates - MVP
- A User should be able to author and run rules against existing Azure Resources
- User must supply the Subscription ID to use ResourceManagementClient
- Scopes 
    - Resource Group - Scans across the Resource Group
        - Group name
    - Deployment - Scans across the resources in the deployment
        - Resource Group
            - Group name
            - Deployment name
        - Subscription
            - Subscription Id
            - Deployment name
        - Managment Group
            - Group Id
            - Deployment name
        - Tenant
            - Deployment name
        - Scope
            - scope
                - /subscriptions/{subscriptionId}
                - /providers/Microsoft.Management/managementGroups/{managementGroupName}
                - /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}
            - Deployment name  

#### User Supplied ARM Templates
- A User should be able to author and run rules against a user supplied template
- Challenges
    - user defined functions
    - functions across scopes
    - linked templates
    - nested templates 
    - parameters/variables
    - template validation?
    - some properties might not be provided by the user - we would need to look for default values when those properties were not found
    - "copy" - evaluating copied resources should be accounted for
- Scopes
    - Resource group
    - Subscription
    - Management
    - Tenant 

#### Bicep to JSON ARM Templates
- presents same challenges as user supplied templates 
- other challenges may be presented upon further inspection


### Resource Graph
- scans existing Azure resources
- User can write and execute Resource Graph queries
- Scopes
    - Resource Groups - one or multiple in a single subscription
    - Subscriptions - one or multiple 
#### Limitations 
- Throttling
    - We haven't run into this issue yet, but if more rules were written then this would need to be addressed
    - [guidance](https://docs.microsoft.com/en-us/azure/governance/resource-graph/concepts/guidance-for-throttled-requests)
- Unsupported Resource Types 
    - unsupported types or settings we've needed for specific rules
        - Microsoft.EventHub/namespaces/networkrulesets  
        - Microsoft.Web/sites/config/appsettings
- Can only scan existing Resources   
- Does not support mulitple queries for one rule - must be done in single query