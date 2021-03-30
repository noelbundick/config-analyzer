	- @azure/arm-resources
		○ Export the template by resource group
		○ If not searching by resource Group then you would need to get each resource Group and then run the rules against each one

``` json
{
     "evaluations": [
		{
			"path": ["properties", "ipRules", "length"],
			"expected": 0,
		},
		{
			"path": ["properties", "virtualNetworlRules", "length"],
			"expected": 0,
		}
	]  
}
```