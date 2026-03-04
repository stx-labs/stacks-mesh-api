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
  SENDER_PUBLIC_KEY,
  RECIPIENT_PUBLIC_KEY,
} from './helpers.js';

describe('/construction/derive', () => {
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

  test('derives a valid address from a secp256k1 public key', async () => {
    const res = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: {
        hex_bytes: SENDER_PUBLIC_KEY,
        curve_type: 'secp256k1',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.account_identifier.address);
    // Testnet addresses start with ST
    assert.match(body.account_identifier.address, /^ST/);
  });

  test('derives a consistent address for the same public key', async () => {
    const res1 = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    const res2 = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    const addr1 = JSON.parse(res1.body).account_identifier.address;
    const addr2 = JSON.parse(res2.body).account_identifier.address;
    assert.equal(addr1, addr2);
  });

  test('derives different addresses for different public keys', async () => {
    const res1 = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    const res2 = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    const addr1 = JSON.parse(res1.body).account_identifier.address;
    const addr2 = JSON.parse(res2.body).account_identifier.address;
    assert.notEqual(addr1, addr2);
  });

  test('rejects unsupported curve types', async () => {
    const res = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: {
        hex_bytes: SENDER_PUBLIC_KEY,
        curve_type: 'edwards25519',
      },
    });
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
  });
});
