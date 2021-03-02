import {ResourceGraphRule, Rule} from './rules';
import * as fs from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  ids: string[];
}

export type RuleSchema = ResourceGraphRuleSchema;

interface BaseRuleSchema {
  name: string;
  description: string;
  type: string;
}

interface ResourceGraphRuleSchema extends BaseRuleSchema {
  type: 'resourceGraph';
  query: string;
}

export class Scanner {
  // filePath was added for testing purposes
  async scan(queryType: RuleSchema['type'], target: string, filePath?: string) {
    const rules = this.makeRules(queryType, target, filePath);
    return Promise.all(rules.map(r => r.execute()));
  }

  private loadRuleData(file = '../../rules.json') {
    // filePath will eventually be replaced with a url
    const filePath = path.join(__dirname, file);
    const data = fs.readFileSync(filePath, 'utf8');
    const rules: RuleSchema[] = JSON.parse(data);
    return rules;
  }

  private makeRules(
    queryType: RuleSchema['type'],
    target: string,
    filePath?: string
  ) {
    const ruleData = this.loadRuleData(filePath);
    const rules: Rule[] = [];
    for (const r of ruleData) {
      switch (queryType) {
        case 'resourceGraph':
          if (r.type === 'resourceGraph') {
            rules.push(new ResourceGraphRule(r, target));
          }
          break;
      }
    }
    return rules;
  }
}
