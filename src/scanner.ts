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

  filterRules(type: RuleContext['type'], context: RuleContext[]) {
    return context.filter(r => r.type === type)[0];
  }

  async getRulesFromFile(
    type: RuleContext['type'],
    filePath = '../rules.json'
  ) {
    const absPath = path.join(__dirname, filePath);
    const data = await fsPromises.readFile(absPath, 'utf8');
    const rules: RuleContext[] = JSON.parse(data);
    const filteredRules = this.filterRules(type, rules);
    return filteredRules;
  }
}
