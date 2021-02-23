export interface Rule {
  name: string;
  description: string;
  resourceGraph?: ResourceGraphQuery;
}

export interface ResourceGraphQuery {
  query: string;
}
