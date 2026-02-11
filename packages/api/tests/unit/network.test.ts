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

  describe('/status', () => {
    test('should return the network status', async () => {
      const mockNodeInfo = {
        peer_version: 402653189,
        pox_consensus: 'abc123',
        burn_block_height: 800000,
        stable_pox_consensus: 'def456',
        stable_burn_block_height: 799999,
        server_version: 'stacks-node 3.0.0',
        network_id: 1,
        parent_network_id: 1,
        stacks_tip_height: 150000,
        stacks_tip: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        stacks_tip_consensus_hash: 'aaa111',
        genesis_chainstate_hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
        unanchored_tip: null,
        unanchored_seq: null,
        tenure_height: 150000,
        exit_at_block_height: null,
        is_fully_synced: true,
        node_public_key: '0x02abc',
        node_public_key_hash: '0x1234',
        last_pox_anchor: {
          anchor_block_hash: '0xaaa',
          anchor_block_txid: '0xbbb',
        },
        stackerdbs: [],
      };
      const mockNeighbors = {
        bootstrap: [],
        sample: [
          {
            network_id: 1,
            peer_version: 402653189,
            ip: '1.2.3.4',
            port: 20444,
            public_key_hash: 'peer-hash-1',
            authenticated: true,
            stackerdbs: [],
            age: 100,
          },
        ],
        inbound: [
          {
            network_id: 1,
            peer_version: 402653189,
            ip: '5.6.7.8',
            port: 20444,
            public_key_hash: 'peer-hash-2',
            authenticated: true,
            stackerdbs: [],
            age: 200,
          },
        ],
        outbound: [],
      };

      const mockPool = mockAgent.get('http://test.stacks.node');
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, mockNodeInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/neighbors', method: 'GET' })
        .reply(200, mockNeighbors, {
          headers: { 'content-type': 'application/json' },
        });

      const now = Date.now();
      const response = await fastify.inject({
        url: '/network/status',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: {
            blockchain: 'stacks',
            network: 'testnet',
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.deepStrictEqual(json.current_block_identifier, {
        index: mockNodeInfo.stacks_tip_height,
        hash: mockNodeInfo.stacks_tip,
      });
      assert.deepStrictEqual(json.genesis_block_identifier, {
        index: 0,
        hash: mockNodeInfo.genesis_chainstate_hash,
      });
      assert.deepStrictEqual(json.sync_status, {
        current_index: mockNodeInfo.stacks_tip_height,
        synced: mockNodeInfo.is_fully_synced,
      });
      // Timestamp should be close to `now` (within 1 second)
      assert.ok(
        json.current_block_timestamp >= now &&
          json.current_block_timestamp <= now + 1000,
        `Expected timestamp close to ${now}, got ${json.current_block_timestamp}`
      );
      assert.deepStrictEqual(json.peers, [
        {
          peer_id: 'peer-hash-1',
          metadata: { ip: '1.2.3.4', port: 20444 },
        },
        {
          peer_id: 'peer-hash-2',
          metadata: { ip: '5.6.7.8', port: 20444 },
        },
      ]);
    });
  });
});
