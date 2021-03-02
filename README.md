# config-analyzer

Azure Configuration Analyzer

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
* [`aza hello [FILE]`](#aza-hello-file)

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
<!-- commandsstop -->

# Development

To run the integration tests:

- Copy `.env.template` to `.env` and fill with your desired values
- `npm test`
