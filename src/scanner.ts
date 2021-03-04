import {
  ResourceGraphRule,
  IResourceGraphRule,
  Rule,
  DummyRule,
  IDummyRule,
} from './rules';
import {promises as fsPromises} from 'fs';
import * as path from 'path';

export interface ScanResult {
  ruleName: string;
  description: string;
  total: number;
  ids: string[];
}

export class Scanner {
  private _rules: Rule[] = [];

  async scan(ruleType: Rule['type'], target: string, ruleNames?: string[]) {
    if (!this._rules.length) await this.loadRulesFromFile();
    if (ruleNames) this._rules.filter(r => ruleNames.includes(r.name));
    return this._executeRules(ruleType, target, ruleNames);
  }

  async loadRulesFromFile(filePath = '../rules.json') {
    const absPath = path.join(__dirname, filePath);
    const data = await fsPromises.readFile(absPath, 'utf8');
    this._rules = JSON.parse(data);
  }

  private _executeRules(
    type: Rule['type'],
    target: string,
    ruleNames?: string[]
  ) {
    let filteredRules = this._rules.filter(r => r.type === type);
    if (ruleNames) {
      filteredRules = filteredRules.filter(r => ruleNames.includes(r.name));
    }
    switch (type) {
      case 'resourceGraph': {
        return ResourceGraphRule.execute(
          filteredRules as IResourceGraphRule[],
          target
        );
      }
      case 'dummy': {
        return DummyRule.execute(filteredRules as IDummyRule[]);
      }
    }
  }
}
