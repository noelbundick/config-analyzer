export interface RuleDefinition {
  name: string;
  description: string;
  resourceGraph?: ResourceGraphQueryDefinition;
}

export interface ResourceGraphQueryDefinition {
  query: string;
}
