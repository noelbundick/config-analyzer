# config-analyzer

Azure Configuration Analyzer

# Overview

`aza` is a console app that evaluates rules against an Azure configuration to perform semantic analysis. It is capable of analyzing complex configurations that span multiple resources and helps developers with remediation by providing direct links to product documentation.

- Rule types:
  - [ARM Template](/docs/rules-armTemplate.md)
  - [Resource Graph](/docs/rules-resourceGraph.md)

# Usage

<!-- usage -->
```sh-session
$ npm install -g aza
$ aza COMMAND
running command...
$ aza (-v|--version|version)
aza/0.0.0 linux-x64 node-v14.15.5
$ aza --help [COMMAND]
USAGE
  $ aza COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`aza scan`](#aza-scan)

## `aza scan`

Scans Azure resources for potential configuration issues

```
USAGE
  $ aza scan

OPTIONS
  -f, --file=file    JSON rules file path
  -g, --group=group  Azure resource groups to scan
  -h, --help         show CLI help
  -s, --scope=scope  Azure subscription id to scan
  -t, --template     runs rules against an exported ARM template
  -v, --verbose      prints all results
  --debug            prints debugging logs

EXAMPLE
  $ aza scan --scope <SCOPE>
       [rule-name]
           [✓ | ❌][rule-description]     
           Resources:
                   [resource-ids]

       [total-passing]
       [total-failing]
       [total-rules-scanned]
```
<!-- commandsstop -->

# Development

To run the integration tests:

- Configure Azure Key Vault
  - `az keyvault create -n <VAULT_NAME> -g <RESOURCE_GROUP>`
  - `az keyvault set --vault-name <VAULT_NAME> -n DefaultAdminPasswordSecret --value <VM_PASSWORD>`
- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
