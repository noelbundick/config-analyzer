# Authoring Rules

## Overview
Rules are authored in JSON. Every rule contains metadata (`name`, `description`, `type`) and evaluation data. All rules can executed against a target that can be generated from the CLI input.  

``` json
  {
    "name": "rule name",
    "description": "short description of the rule",
    "type": "type of rule",
    "recommendation": "optional link on how to fix the issue"
  },
```

### Rule Types
- `type`: 'ResourceGraph'
- `type`: 'ARM'
---
### Resource Graph Rule
The execution data for a Resource Graph rule is a Resource Graph query
see [Resource Graph Docs](https://docs.microsoft.com/en-us/azure/governance/resource-graph/) for more information on writing queries.

``` json
{
	"name": "get-vnets",
	"description": "returns all VNets in the target scope",
	"type": "ResourceGraph",
	"query": "Resources | where type =~ 'Microsoft.Network/virtualNetworks'"
}
```

**Requirements**   

All queries must start with '`<tableName>` |'. While it is a Microsoft recommendation to begin Resource Graph queries with the table name, it is not required and defaults to the Resource Table. However, for this application, this is a requirement to allow for filtering Resource Groups. See [Resource Graph Tables](https://docs.microsoft.com/en-us/azure/governance/resource-graph/concepts/query-language#resource-graph-tables) for more information on tables.

**Target**  

The application can scan Azure Resources across multiple subscriptions or a single subscription and optionally filter for resource groups.

**CLI Usage**  

aza scan --scope [subscriptionId1] --scope [subscriptionId2]  
aza scan --scope [subscriptionId] --group [resourceGroupName1] --group [resourceGroupName2]

