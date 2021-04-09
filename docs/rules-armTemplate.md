# ARM Template Rules

ARM template rules can export an ARM template and scan it for configuration issues. Simple rules can be evaluated against a single resource type. Complex analysis can be performed by performing evaluations across multiple resources.

## Evaluation Object

- The rules contain one top level evaluation
- An evaluation will match resources if the resource matches the `query` condition, specified in [JMESPath](https://jmespath.org/) syntax
- If resources are found, they can be further filtered with further evaluations by using the `and` key
  - Child evaluations can access properties (including nested properties) of the parent resource via the `{{parent}}` variable in the `query` using [Handlebars](https://handlebarsjs.com/) syntax
  - Ex: `` starts_with(name, `{{parent.name}}`) ``

### Examples

Simple example that finds all Storage Accounts with the storage firewall disabled

```json
{
  "name": "storage-public",
  "description": "Storage Accounts with Internet access",
  "type": "ARM",
  "recommendation": "optional link to docs on how to fix the issue"
  "evaluation": {
    "query": "type == `Microsoft.Storage/storageAccounts` && properties.networkAcls.defaultAction == `Allow`"
  }
}
```

Find all Storage Accounts that have Private Endpoints enabled, but have not disabled Internet access via the storage firewall. These may have been accidentally left open, which could be a compliance violation.

```json
{
  "name": "storage-unintendedPublic",
  "description": "Storage Accounts that are configured for Private Endpoint but still allow Internet traffic",
  "type": "ARM",
  "recommendation": "optional link to docs on how to fix the issue",
  "evaluation": {
    "query": "type == `Microsoft.Storage/storageAccounts` && properties.networkAcls.defaultAction == `Allow`",
    "and": [
      {
        "query": "type == `Microsoft.Storage/storageAccounts/privateEndpointConnections` && starts_with(name, `{{parent.name}}/`)"
      }
    ]
  }
}
```
