import {provisionIntegrationTests} from '.';
import {provisionEnvironment, teardownEnvironment} from './provision';

const sleep = (ms: number) => {
  return new Promise(callback => setTimeout(callback, ms));
};

before(async function () {
  this.slow(60000);
  this.timeout(300000);

  if (!provisionIntegrationTests) {
    this.skip();
  }

  await provisionEnvironment();
  await sleep(5000);
});

after(async () => {
  if (!provisionIntegrationTests) {
    return;
  }

  await teardownEnvironment();
});
