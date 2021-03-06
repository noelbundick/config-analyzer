import {ResourceGraphRule, DummyRule, RuleContext} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  resources: {id: string}[];
}

export class Scanner {
  async scan(context: RuleContext, target: string | object) {
    switch (context.type) {
      case 'resourceGraph': {
        context.subscriptionId = target as string;
        return ResourceGraphRule.execute(context);
      }
      case 'dummy': {
        context.target = target as object;
        return DummyRule.execute(context);
      }
    }
  }

  getContextByType(type: RuleContext['type'], contexts: RuleContext[]) {
    return contexts.filter(r => r.type === type)[0];
  }

  // typescript issue with filtering discriminated unions
  // look into this further
  filterRulesByName(names: string[], context: RuleContext) {
    switch (context.type) {
      case 'resourceGraph':
        context.rules = context.rules.filter(r => names.includes(r.name));
        break;
      case 'dummy':
        context.rules = context.rules.filter(r => names.includes(r.name));
        break;
    }
    return context;
  }

  async getRulesFromFile(
    type: RuleContext['type'],
    filePath = '../rules.json',
    ruleNames?: string[]
  ) {
    const absPath = path.join(__dirname, filePath);
    const data = await fsPromises.readFile(absPath, 'utf8');
    const contexts: RuleContext[] = JSON.parse(data);
    const ruleContext = this.getContextByType(type, contexts);
    ruleNames && this.filterRulesByName(ruleNames, ruleContext);
    return ruleContext;
  }
}
