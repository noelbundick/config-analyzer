import JMESPath = require('jmespath');
import Handlebars = require('handlebars');
import {promises as fsPromises} from 'fs';

import {BaseRule, Evaluation, isAndEvaluation, RuleType} from '.';
import {ScanResult} from '../scanner';

export interface TerraformTarget {
  type: RuleType.Terraform;
  plan: TerraformResource[];
}

export interface TerraformResource {
  address: string;
}

export class TerraformRule implements BaseRule<TerraformTarget> {
  type: RuleType.Terraform;
  name: string;
  description: string;
  evaluation: Evaluation;
  recommendation: string;

  constructor(rule: {
    type: RuleType.Terraform;
    name: string;
    description: string;
    evaluation: Evaluation;
    recommendation: string;
  }) {
    this.type = rule.type;
    this.name = rule.name;
    this.description = rule.description;
    this.evaluation = rule.evaluation;
    this.recommendation = rule.recommendation;
  }

  async execute(target: TerraformTarget): Promise<ScanResult> {
    const results = this.evaluate(this.evaluation, target.plan);
    return Promise.resolve(this.toScanResult(results));
  }

  static async getTarget(planFilePath: string): Promise<TerraformTarget> {
    const data = await fsPromises.readFile(planFilePath, 'utf8');
    const plan = JSON.parse(data);
    return {
      type: RuleType.Terraform,
      plan,
    };
  }

  evaluate(
    evaluation: Evaluation,
    plan: TerraformResource[],
    parent?: TerraformResource
  ): Array<TerraformResource> {
    const query = this.render(evaluation.query, parent);
    const resources = JMESPath.search(plan, query) as Array<TerraformResource>;
    // If we found resources with the initial query, filter those down to the ones that meet all the criteria
    if (resources.length > 0 && isAndEvaluation(evaluation)) {
      return resources.filter(resource =>
        evaluation.and.every(e => this.evaluate(e, plan, resource).length > 0)
      );
    }

    return resources;
  }

  render(query: string, parent?: TerraformResource): string {
    let text = query;
    if (parent) {
      const template = Handlebars.compile(text);
      text = template({parent});
    }
    return text;
  }

  toScanResult(resources: Array<TerraformResource>): ScanResult {
    return {
      ruleName: this.name,
      description: this.description,
      recommendation: this.recommendation,
      total: resources.length,
      resourceIds: resources.map(r => r.address),
    };
  }
}
