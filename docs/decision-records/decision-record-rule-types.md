# ADR for AZA Scanner Rule Types 
* Date: 2021-04-05

## Context and Problem Statement

There are a wide range of issues and challenge when it comes to integrating with VNETs in Azure that may not be immediately apparent to the customer or CSE dev crews. This project aims to identify those issues and notify the user of ways to fix the problem. This document represents the pros and cons of the different ways to scan Azure Resources and the decision process for evaluating which scenerios to support. 

## Decision Drivers

* How does it help the customer?
* What are the use cases?
* What are the limitations?
* Can it scan existing Resources as well as not yet created Resources?

## Considered Options

* ARM Templates
* What if deployments
* Bicep deployments
* Terraform
* Resource Graph

## Decision Outcome

Chosen options: 
(Best option) - "ARM Templates", because it allows for existing and yet to be created infrasturce to be scanned for issues.     
(Second Best option) - "Terraform", because not all customer use ARM templates and it would be valuable to have the ability to run the rules against a multi-cloud IaC.  
(First Chosen option) - "Resource Graph", We thought this would be the best option, but after further review, not all the rules could be run against Resource Graph because it doesn't support all the settings needed to evaluate some rules.  

### Priorities
MVP  
* Resource Graph Rule
* ARM template (exported at Resource Group Scope)  

Future 
* Arm Template (user supplied, deployment scopes)
* Bicep option can be accomplished through compiling down to ARM Templates, so not much would need be changed to add this functionality.
* Terraform rules are a great option and should be pursued after completing previous options.   
* What if option is probably not worth pursuing.   

## Pros and Cons of the Options 

### ARM Templates

* Good, because Bicep deployments can be converted to ARM templates
* Good, because existing infrastructure can be exported as an ARM template 
* Good, because not yet deployed infrastucture can be scanned before deployment  
* Bad, because there are no Typscript Types for Azure Resources and ARM templates
* Bad, because there is potential for rules to be outdated due to changes to ARM Template api versions, schemas, or functions
* Bad, because challenges 

### What If Deployments

* Good, because it can run against resources before they are deployed or changed
* Bad, because it only tracks the changes and not any other resources that havent been changed
* Bad, because it may be difficult to test rules that evaluate mutiple resources. Both resources would need to be changed in order to correctly evaluate the rule
* Bad, because it might take longer to evaluate because it relys on the what if deployment to run before the scan happens

### Bicep Deployments

* Good, because customers might use Bicep more in the future as opposed to ARM templates because of the improvements Bicep brings 
* Bad, because Bicep is compiles to JSON so it might be more useful to have rules for the JSON rather than the language specific Bicep
* Bad because its still in preview, so there might be less immediate use cases

### Terraform

* Good, because some customers prefer Terraform vs. ARM templates 
* Good, because it could support scanning IaC across mutiple providers
* Bad, because SDK does not support Terraform operations and there is no way to export a terraform template through Azure. This may be possible through another tool, but it would ideal to find an option that supports all resource types.

### Resource Graph

* Good, because it can scan multiple subscriptions and multiple resource groups in a single subscription
* Good, because it has a feature to query additional type-related properties beyond the properties provided by Azure Resource Manager
* Bad, because not all resource types or their properties can be queried (this is the main reason to not choosing this option)
* Bad, because queries can be throttled, making it potentially more difficult/time consuming to scan a lot of rules at once
* Bad, becasue there is a default limit of 3 joins per query (this is not a problem for most rules)
