import {provisionIntegrationTests} from '.';
import {provisionEnvironment, teardownEnvironment} from './provision';

const sleep = (ms: number) => {
  return new Promise(callback => setTimeout(callback, ms));
};

exports.mochaHooks = {
  beforeAll: async function () {
    this.slow(60000);
    this.timeout(300000);

    if (!provisionIntegrationTests) {
      this.skip();
    }
    console.log('Provisioning Test Environment...');
    await provisionEnvironment();
    await sleep(5000);
  },
  afterAll: async function () {
    this.slow(60000);
    this.timeout(300000);

    if (!provisionIntegrationTests) {
      return;
    }
    console.log('Tearing Down Test Environment...');
    await teardownEnvironment();
  },
};
