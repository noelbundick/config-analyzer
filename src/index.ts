import {ResourceManagementClient} from '@azure/arm-resources';
import {credential} from '../test/azure';
import {AzureIdentityCredentialAdapter} from './azure';
import {ARMResource, EventHubNetworkRuleSet} from './index2';
import _ = require('lodash');

const resourceClient = new ResourceManagementClient(
  new AzureIdentityCredentialAdapter(credential),
  '6c1f4f3b-f65f-4667-8f9e-b9c48e09cd6b'
);

const json = {
  evaluations: [
    {
      path: ['properties', 'ipRules', 'length'],
      expected: 0,
    },
    {
      path: ['properties', 'virtualNetworlRules', 'length'],
      expected: 0,
    },
  ],
};

type IfKey<T, K> = [K] extends [keyof T] ? T[K] : T;

declare function byPath<
  T0,
  K1 extends keyof T0 | undefined,
  T1 extends IfKey<T0, K1>,
  K2 extends keyof T1 | undefined,
  T2 extends IfKey<T1, K2>,
  K3 extends keyof T2 | undefined,
  T3 extends IfKey<T2, K3>,
  K4 extends keyof T3 | undefined,
  T4 extends IfKey<T3, K4>,
  K5 extends keyof T4 | undefined,
  T5 extends IfKey<T4, K5>,
  K6 extends keyof T5 | undefined,
  T6 extends IfKey<T5, K6>
>({state, path}: {state: T0; path: [K1?, K2?, K3?, K4?, K5?, K6?]}): T6;

const myState = {
  type: 'Microsoft.EventHub/namespaces/networkRuleSets',
  apiVersion: '2018-01-01-preview',
  name: "[concat(parameters('namespaces_josh_trash_name'), '/default')]",
  location: 'West US',
  dependsOn: [
    "[resourceId('Microsoft.EventHub/namespaces', parameters('namespaces_josh_trash_name'))]",
  ],
  properties: {defaultAction: 'Allow', virtualNetworkRules: [], ipRules: []},
} as EventHubNetworkRuleSet;

// const ret = byPath({state: myState, path: ['properties', 'ipRules', 'length']});

async function getResources() {
  // const myList = await resourceClient.resources.list();
  const id =
    '/subscriptions/6c1f4f3b-f65f-4667-8f9e-b9c48e09cd6b/resourceGroups/josh-trash/providers/Microsoft.EventHub/namespaces/josh-trash/networkRuleSets/default';
  // const myList2 = await resourceClient.resources.getById(id, '2017-04-01');
  const myList5 = await resourceClient.resourceGroups.exportTemplate(
    'josh-trash',
    {resources: ['*']}
  );

  const networkRuleSets = myList5.template.resources.filter(
    (r: ARMResource) =>
      r.type === 'Microsoft.EventHub/namespaces/networkRuleSets'
  ) as EventHubNetworkRuleSet[];

  networkRuleSets.forEach((element: ARMResource) => {
    const res = _.get(element, json.evaluations[0].path);
    if (res === json.evaluations[0].expected) {
      console.log('broken rule');
    }
    console.log(res);
  });

  // myList5.template.resources.forEach((r: ARMResource) => {
  //   switch (r.type) {
  //     case 'Microsoft.EventHub/namespaces/networkRuleSets': {
  //       const res = _.get(r, json.evaluations[0].path);
  //       console.log(res);
  //       break;
  //     }
  //     case 'Microsoft.Storage/storageAccounts':
  //       break;
  //   }
  // });
}

getResources();
