import {
  ResourceGraphRule,
  ResourceGraphTarget,
  Rule,
  Target,
  RuleType,
  ARMTemplateRule,
  ARMTarget,
  TerraformRule,
  TerraformTarget,
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
  async scan(target: Target, filePath?: string) {
    const rules = await this.getRulesFromFile(filePath);
    const filteredRules = rules.filter(r => r.type === target.type);
    const results = this.execute(filteredRules, target);
    return Promise.all(results);
  }

  async getRulesFromFile(
    filePath = path.join(__dirname, '../rules.json')
  ): Promise<Rule[]> {
    const data = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(data);
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
        case RuleType.Terraform:
          r = new TerraformRule(r);
          return r.execute(target as TerraformTarget);
      }
    });
  }
}
