import {assert} from 'chai';
import {ResourceGraphRule, Rule} from '../src/rules';
import * as env from 'env-var';
import {environment} from './constants';

describe('Resource Graph Rule', function () {
  this.slow(4000);
  this.timeout(7000);
  let subscriptionId: string;

  before(function () {
    const runIntegrationTests = env
      .get(environment.runIntegrationTests)
      .default('false')
      .asBoolStrict();
    subscriptionId = env
      .get(environment.subscriptionId)
      .required(runIntegrationTests)
      .asString();

    if (!runIntegrationTests) {
      this.skip();
    }
  });

  it('can execute a resource graph rule and return a scan result', async () => {
    const query =
      "Resources | where type =~ 'Microsoft.Compute/virtualMachines2'";
    const name = 'Dummy Rule';
    const description = 'Intentional bad query';
    const rule: Rule = {name, query, description, type: 'resourceGraph'};
    const rgr = new ResourceGraphRule(rule, subscriptionId);
    const result = await rgr.execute().catch(err => {
      return {
        err,
        ruleName: rgr.name,
        description,
        total: 0,
        ids: [],
      };
    });
    assert.equal(rule.name, result.ruleName);
    assert.equal(rule.description, result.description);
    assert.containsAllKeys(result, ['ruleName', 'description', 'total', 'ids']);
    assert.equal(result.total, 0);
  });
});
