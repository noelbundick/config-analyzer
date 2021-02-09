# Commands

```shell
# Show usage information
aza
```

## Scanning

The primary function of the app is to scan 

```shell
# Scan an Azure subscription, resource group, or resource using all registered rules
aza scan --scope <SCOPE>

# Scan a file or folder using all registered rules
aza scan --file <FILE>

# Scan using only one rule
aza scan --rule <RULE> --scope <SCOPE>
```

# Flags

Each command may have specific flags, but the following are common across all commands

```shell
# Show help for any command
aza <command> --help

# Show verbose debugging information
aza <command> --debug
```

Flags can be specified using either long or short syntax

```shell
# The following commands are equivalent
az scan --file azuredeploy.json --rule Rule1
az scan -f azuredeploy.json -r Rule1
```
