import {
  ResourceGraphRule,
  ResourceGraphTarget,
  Rule,
  Target,
  RuleType,
  ARMTemplateRule,
  ARMTarget,
} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  recommendation?: string;
  total: number;
  resourceIds: string[];
}

export class Scanner {
  rules: Rule[] = [];

  async scan(target: Target) {
    if (!this.rules.length) await this.loadRulesFromFile();
    const filteredRules = this.rules.filter(r => r.type === target.type);
    const results = this.execute(filteredRules, target);
    return Promise.all(results);
  }

  async loadRulesFromFile(filePath = path.join(__dirname, '../rules.json')) {
    const data = await fsPromises.readFile(filePath, 'utf8');
    this.rules = JSON.parse(data);
  }

  execute(rules: Rule[], target: Target) {
    return rules.map(r => {
      switch (r.type) {
        case RuleType.ResourceGraph:
          r = new ResourceGraphRule(r);
          return r.execute(target as ResourceGraphTarget);
        case RuleType.ARM:
          r = new ARMTemplateRule(r);
          return r.execute(target as ARMTarget);
      }
    });
  }
}
