# config-analyzer

Azure Configuration Analyzer

# Usage

<!-- usage -->
```sh-session
$ npm install -g aza
$ aza COMMAND
running command...
$ aza (-v|--version|version)
aza/0.0.0 win32-x64 node-v14.15.4
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
  -d, --dummy        runs dummy rules to mock multi rule system
  -f, --file=file    JSON rules file path
  -h, --help         show CLI help
  -s, --scope=scope  Azure subscription id to scan
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

- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
