import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { buildApiServer, RouteConfig } from '../../src/api/index.js';
import { StacksRpcClient } from '../../src/services/stacks-rpc-client.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

describe('/network', () => {
  let fastify: FastifyInstance;
  let rpcClient: StacksRpcClient;
  let mockAgent: MockAgent;
  let config: RouteConfig;

  beforeEach(async () => {
    rpcClient = new StacksRpcClient({
      baseUrl: 'http://test.stacks.node',
      authToken: 'test-token',
    });
    config = {
      rpcClient,
      network: 'testnet',
      nodeVersion: '1.0.0',
    };
    fastify = await buildApiServer(config);
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  describe('/list', () => {
    test('should return the network list', async () => {
      const response = await fastify.inject({
        url: '/network/list',
        method: 'POST',
        payload: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
        },
      });
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.deepStrictEqual(json, {
        network_identifiers: [
          {
            blockchain: 'stacks',
            network: 'testnet',
          },
        ],
      });
    });
  });
});
