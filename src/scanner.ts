import {ResourceGraphRule, Rule, DummyRule} from './rules';
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

  async scan(ruleType: Rule['type'], target: string) {
    if (!this._rules.length) await this.loadRulesFromFile();
    const results = this._executeRules(ruleType, target);
    return await Promise.all(results);
  }

  async loadRulesFromFile(filePath = '../../rules.json') {
    const absPath = path.join(__dirname, filePath);
    const data = await fsPromises.readFile(absPath, 'utf8');
    this._rules = JSON.parse(data);
  }

  private _executeRules(type: Rule['type'], target: string) {
    const results: Promise<ScanResult>[] = [];
    const filteredRules = this._rules.filter(r => r.type === type);
    for (const r of filteredRules) {
      switch (r.type) {
        case 'resourceGraph': {
          const result = ResourceGraphRule.execute(r, target);
          results.push(result);
          break;
        }
        case 'dummy': {
          const result = DummyRule.execute(r);
          results.push(result);
          break;
        }
      }
    }
    return results;
  }
}
