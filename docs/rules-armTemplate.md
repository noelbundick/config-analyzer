# ARM Template Rules

ARM template rules can export an ARM template and scan it for configuration issues. Simple rules can be evaluated against a single resource type. Complex analysis can be performed by performing evaluations across multiple resources.

## Evaluation Object

- The rules contain one top level evaluation
- An evaluation will match resources if the resource matches the `query` condition, specified in [JMESPath](https://jmespath.org/) syntax
- If resources are found, they can be further filtered with further evaluations by using the `and` key
  - Child evaluations can access properties (including nested properties) of the parent resource via the `{{parent}}` variable in the `query` using [Handlebars](https://handlebarsjs.com/) syntax
  - Ex: `` starts_with(name, `{{parent.name}}`) ``
- Some configuration settings do not come back from an exported ARM Template. For those settings, an additional evaluation can be added by using the `request` key in the top level evaluation
  - Request evaluations have `operation` and `query` keys
    - operation
      - under the hood, the operation value is used to make a POST request to the Azure REST API. A url is built for each resource found after the top level and `and` queries are evaluated. 
      - the request url becomes https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${groupName}/providers/${resource.type}/${resource.name}/${request.operation}?api-version=${resource.apiVersion} where `request.operation` is the user supplied path.
      - a list of API endpoints can be found at [Azure REST API Reference](https://docs.microsoft.com/en-us/rest/api/azure/)
    - query 
      - the JMESPATH query used to run against the API response.  

### Examples

Simple example that finds all Storage Accounts with the storage firewall disabled

```json
{
  "name": "storage-public",
  "description": "Storage Accounts with Internet access",
  "type": "ARM",
  "recommendation": "optional link to docs on how to fix the issue",
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
Example with a Request Evaluation  
Finds Function Apps integrated with a virtual network but the app settings for WEBSITE_VNET_ROUTE_ALL is not 1 and WEBSITE_DNS_SERVER is not 168.63.129.16. 


Since exported templated do not return the config app settings for function apps, An REST call must be made to retrive those settings. The request `query` is then used to filter the found resources from the top level evaluation and `and` evaluation against the REST response.  
```json
  {
    "name": "function-app-vnet-integration-misconfiguration",
    "description": "",
    "type": "ARM",
    "recommendation": "https://github.com/noelbundick/config-analyzer/blob/main/docs/built-in-rules.md#function-app-vnet-integration-misconfiguration",
    "evaluation": {
      "query": "type == `Microsoft.Web/sites`",
      "request": {
        "operation": "config/appsettings/list",
        "query": "properties.WEBSITE_DNS_SERVER != '168.63.129.16' || properties.WEBSITE_VNET_ROUTE_ALL != '1'"
      },
      "and": [
        {
          "query": "type == `Microsoft.Web/sites/virtualNetworkConnections` && starts_with(name, `{{parent.name}}/`)"
        }
      ]
    }
  }
```

*Note*
When writing queries for ARM templates, it is important to know when to use `backticks` and when to use `single quotes`. If you are searching for an integer, then you should use `backticks`. If you are searching a string, often times you use either `single quotes` or `backticks`. However, if the property is a stringed integer `"1"` then backticks will not accurately evaluate the property. If it is not clear that the property you are searching for will come back as a string or an integer, it is suggested construct a query that checks for both options to prevent rules from being inaccurately evaluated. See the examples below for the JMESPATH behavior.

``` json 
{
  "stringInteger": "1",
  "string": "Hello World",
  "integer": 1,
}
```

Using the above JSON object:
```
stringInteger == '1' => true  
stringInteger == `1` => false

string == 'Hello World' => true  
string == `Hello World` => true

integer == '1' => false  
integer == `1` => true

```