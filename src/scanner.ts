import {ResourceGraphRule, DummyRule, RuleContext} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  resources: {id: string}[];
}

// export interface Id {
//   id: string;
// }

export class Scanner {
  async scan(context: RuleContext, target: string) {
    switch (context.type) {
      case 'resourceGraph': {
        return ResourceGraphRule.execute(context.rules, target);
      }
      case 'dummy': {
        return DummyRule.execute(context.rules);
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
