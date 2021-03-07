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
  -e, --err=err    throws error
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
  -h, --help         show CLI help
  -r, --rule=rule    rules to execute
  -s, --scope=scope  azure subscription, resoucres id to scan

EXAMPLE
  $ aza scan --scope <SCOPE>
```
<!-- commandsstop -->

# Development

To run the integration tests:

- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
