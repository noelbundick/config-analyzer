import {
  ResourceGraphExecutor,
  ResourceGraphRule,
  ResourceGraphTarget,
  Rule,
  DummyRuleExecutor,
  DummyRule,
  Target,
  RuleType,
} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  resourceIds: string[];
}

export class Scanner {
  rules: Rule[] = [];

  async scan(target: Target) {
    if (!this.rules.length) await this.loadRulesFromFile();
    return this.executeRules(target);
  }

  async loadRulesFromFile(filePath = '../rules.json') {
    const absPath = path.join(__dirname, filePath);
    const data = await fsPromises.readFile(absPath, 'utf8');
    this.rules = JSON.parse(data);
  }

  private executeRules(target: Target) {
    const filteredRules = this.rules.filter(r => r.type === target.type);
    switch (target.type) {
      case RuleType.ResourceGraph: {
        return ResourceGraphExecutor.execute(
          filteredRules as ResourceGraphRule[],
          target as ResourceGraphTarget
        );
      }
      case RuleType.Dummy: {
        return DummyRuleExecutor.execute(filteredRules as DummyRule[]);
      }
    }
  }
}
