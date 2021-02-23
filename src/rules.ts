export interface Rule {
  name: string;
  description: string;
  resourceGraph?: ResourceGraphQuery;
}

export interface ResourceGraphQuery {
  query: string;
}

export interface RuleExecutor {
  execute(): Promise<ScanResult>;
}

export interface ScanResult {
  id: string;
  ruleName: string;
}
