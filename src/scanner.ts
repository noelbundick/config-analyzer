import {ResourceGraphRule, DummyRule, RuleContext} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  resources: Id[];
}

export interface Id {
  id: string;
}

export class Scanner {
  async scan(ruleObj: RuleContext, target: string) {
    switch (ruleObj.type) {
      case 'resourceGraph': {
        return ResourceGraphRule.execute(ruleObj.rules, target);
      }
      case 'dummy': {
        return DummyRule.execute(ruleObj.rules);
      }
    }
  }

  filterRules(type: RuleContext['type'], RuleContexts: RuleContext[]) {
    return RuleContexts.filter(r => r.type === type)[0];
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
