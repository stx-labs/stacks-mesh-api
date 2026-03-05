import * as assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  API_PORT,
  type DockerResources,
  post,
  NETWORK_IDENTIFIER,
} from './helpers.js';

describe('/construction/submit', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;

  before(
    async () => {
      dockerResources = await setupDockerServices();
      fastify = await buildTestServer();
      await fastify.listen({ host: '0.0.0.0', port: API_PORT });
    },
    { timeout: 120_000 }
  );

  after(
    async () => {
      await fastify?.close();
      await teardownDockerServices(dockerResources);
    },
    { timeout: 30_000 }
  );

  test('broadcasts a signed transaction and returns a txid', async () => {
    const signedTx =
      '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c8000167b4c3fe49a0e2c99c83d2a181713c164604b4dbd516ef1641596231c070526e217fea3d9db5c0a81008a19b38640c78fa580fcc792f7362f21699e61defc45103020000000000051a43596b5386f466863e25658ddf94bd0fadab004800000000000f424068656c6c6f0000000000000000000000000000000000000000000000000000000000';
    const expectedTxid = '0x2c997f07e2c11ac8e701b1143588a2801984e76c02860f21c766357deeceeb68';

    const res = await post(fastify, '/construction/submit', {
      network_identifier: NETWORK_IDENTIFIER,
      signed_transaction: signedTx,
    });
    assert.equal(res.statusCode, 200, `submit failed: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok(body.transaction_identifier.hash);
    assert.equal(body.transaction_identifier.hash, expectedTxid);
  });
});
