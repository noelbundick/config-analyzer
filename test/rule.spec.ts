import {assert} from 'chai';
import {ResourceGraphQuery, ResourceGraphRule} from '../src/rules';
import * as env from 'env-var';
import {environment} from './constants';

describe('Resource Graph Rule', () => {
  let subscriptionId = '';

  before(function () {
    subscriptionId = env.get(environment.subscriptionId).required().asString();

    if (!subscriptionId) {
      this.skip();
    }
  });

  it('can execute a resource graph rule and return a scan result', async () => {
    const query =
      "Resources | where type =~ 'Microsoft.Compute/virtualMachines'";
    const rule = {
      name: 'Dummy Rule',
      description: '',
      resourceGraph: {
        type: 'resourceGraph',
        query,
      } as ResourceGraphQuery,
    };

    const rgRule = new ResourceGraphRule(
      rule.name,
      rule.resourceGraph,
      subscriptionId
    );

    const result = await rgRule.execute();
    assert.equal(rule.name, result.ruleName);
    assert.containsAllKeys(result, ['ruleName', 'total', 'ids']);
    assert.equal(result.total, result.ids.length);
  });
});
