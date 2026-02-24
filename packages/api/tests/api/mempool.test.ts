import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { buildApiServer } from '../../src/api/index.js';
import { StacksRpcClient } from '../../src/stacks-rpc/stacks-rpc-client.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

describe('/mempool', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    const rpcClient = new StacksRpcClient({
      hostname: 'test.stacks.node',
      port: 20444,
      authToken: 'test-token',
    });
    fastify = await buildApiServer({
      rpcClient,
      network: 'testnet',
      nodeVersion: '1.0.0',
    });
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  test('should return 500 not implemented', async () => {
    const response = await fastify.inject({
      url: '/mempool',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'testnet' },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 500);
    const json = JSON.parse(response.body);

    assert.strictEqual(json.code, 901);
    assert.strictEqual(json.message, 'Not implemented');
    assert.ok(json.description.includes('/mempool is not supported'));
    assert.strictEqual(json.retriable, false);
  });
});

describe('/mempool/transaction', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    const rpcClient = new StacksRpcClient({
      hostname: 'test.stacks.node',
      port: 20444,
      authToken: 'test-token',
    });
    fastify = await buildApiServer({
      rpcClient,
      network: 'testnet',
      nodeVersion: '1.0.0',
    });
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  test('should return 500 not implemented', async () => {
    const response = await fastify.inject({
      url: '/mempool/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'testnet' },
        transaction_identifier: {
          hash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
        },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 500);
    const json = JSON.parse(response.body);

    assert.strictEqual(json.code, 901);
    assert.strictEqual(json.message, 'Not implemented');
    assert.ok(json.description.includes('/mempool/transaction is not supported'));
    assert.strictEqual(json.retriable, false);
  });
});
