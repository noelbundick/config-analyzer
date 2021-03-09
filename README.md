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
* [`aza hello [FILE]`](#aza-hello-file)
* [`aza scan`](#aza-scan)

## `aza hello [FILE]`

describe the command here

```
USAGE
  $ aza hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ ./bin/run hello
  hello world from ./src/hello.ts!
```

## `aza scan`

Scans azure resources for potential configuration issues

```
USAGE
  $ aza scan

OPTIONS
  -d, --dummy        runs dummy rules to mock multi rule system
  -g, --group=group  azure subscription id to scan
  -h, --help         show CLI help
  -r, --rule=rule    rules to execute
  -s, --scope=scope  azure subscription id to scan
  -v, --verbose      prints all results
  --debug            prints debugging logs

EXAMPLE
  $ aza scan --scope <SCOPE>
       [rule-name]
           [✓ | ❌][rule-description]     
           Resources:
                   [resource-ids]

       [number-passing]
       [number-failing]
       [total-rules-scanned]
```
<!-- commandsstop -->

# Development

To run the integration tests:

- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
