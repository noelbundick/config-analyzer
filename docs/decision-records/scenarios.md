# AZA - Scenarios
## What is it?
The goal of this project is to allow a user to quickly scan Azure Resources for potential configuration issues, specifically when it comes to integrating with VNETs. There are a wide range of issues and challenge that may not be immediately apparent to the customer or CSE dev crews, and this project aims to identify and notify the user of ways to fix the problem. This document represents the scenerios chosen from the [Decision Record](https://github.com/noelbundick/config-analyzer/tree/main/docs/decision-records/decision-record-rule-types.md)
## Behavior
 Azure Resources can be scanned in a number of different ways, allowing for many different rule types to be created. All rule types should support the following:
* It should return resources that break a condition along with documentation on how to fix it.    
* It should have the ability for a user author their own rules for supported scenarios.  
* It should support multiple evaluations on a single resource.
* It should support evaluating properties from one resource against another resource

## Scenarios
### ARM Templates 
ARM templates can be created in a few different ways. They can be exported from Azure, user generated, or compiled from a Bicep Deployment. An exported template does not look the same a user generated template. While being able to scan all these template types is beneficial, we should identify the challenges and limitations that come with each option.

#### Exported ARM Templates - MVP
**Challenges and Limitations**
- User must supply the Subscription ID to use ResourceManagementClient
- Only applicable for already existing Resources
- Some properties are not returned from Azure, so further REST calls would be needed to properly evaluate all rules
**Scopes**
- Resource Group
    - Group name
- Deployment - needs the deployment name for all deployment scopes
    - Resource Group
    - Subscription
    - Management Group
    - Tenant
    - At Scope
        - /subscriptions/{subscriptionId}
        - /providers/Microsoft.Management/managementGroups/{managementGroupName}
        - /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}
#### User Supplied ARM Templates
**Challenges and Limitations**
- user defined functions
- functions across scopes
- linked templates
- nested templates 
- parameters/variables
- template validation?
- some properties might not be provided by the user - we would need to look for default values when those properties were not found
- "copy" - evaluating copied resources should be accounted for
**Scopes**
- Resource group
- Subscription
- Management
- Tenant 
#### Bicep to JSON ARM Templates
**Challenges and Limitations**
- presents same challenges as user supplied templates 
- other challenges may be presented upon further inspection

### Resource Graph
Resource Graph can scan existing Azure resources through Kusto query language. It can easily scan across subscriptions or filter for specific resource groups.
**Challenges and Limitations**
- only existing resources can be evaluated 
- Throttling
    - We haven't run into this issue yet, but if more rules were written then this would need to be addressed
    - [guidance](https://docs.microsoft.com/en-us/azure/governance/resource-graph/concepts/guidance-for-throttled-requests)
- Unsupported Resource Types 
    - unsupported types or settings we've needed for specific rules
        - Microsoft.EventHub/namespaces/networkrulesets  
        - Microsoft.Web/sites/config/appsettings
- Can only scan existing Resources   
- Does not support multiple queries for one rule - must be done in single query
**Scopes**
- Resource Groups - one or multiple in a single subscription
- Subscriptions - one or multiple 