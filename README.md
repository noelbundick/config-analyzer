# config-analyzer

Azure Configuration Analyzer

# Overview

`azca` is a console app that evaluates rules against an Azure configuration to perform semantic analysis. It is capable of analyzing complex configurations that span multiple resources and helps developers with remediation by providing direct links to product documentation.

- Rule types:
  - [ARM Template](/docs/rules-armTemplate.md)
  - [Resource Graph](/docs/rules-resourceGraph.md)

# Usage

<!-- usage -->
```sh-session
$ npm install -g azca
$ azca COMMAND
running command...
$ azca (-v|--version|version)
azca/0.0.0 linux-x64 node-v14.15.5
$ azca --help [COMMAND]
USAGE
  $ azca COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`azca scan`](#azca-scan)

## `azca scan`

Scans Azure resources for potential configuration issues

```
USAGE
  $ azca scan

OPTIONS
  -f, --file=file    JSON rules file path
  -g, --group=group  Azure resource groups to scan
  -h, --help         show CLI help
  -s, --scope=scope  Azure subscription id to scan
  -t, --template     runs rules against an exported ARM template
  -v, --verbose      prints all results
  --debug            prints debugging logs

EXAMPLE
  $ azca scan --scope <SCOPE>
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

- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
