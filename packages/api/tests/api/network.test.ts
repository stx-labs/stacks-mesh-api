import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { buildApiServer } from '../../src/api/index.js';
import { loadBinaryFixture, makeTestApiConfig } from './helpers.js';
import { MockAgent } from 'undici';

describe('/network', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    const config = makeTestApiConfig(() => mockAgent);
    fastify = await buildApiServer(config);
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
            network: 'mainnet',
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
        stacks_tip_height: 5437107,
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
          },
        ],
        outbound: [],
      };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
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
      const blockHeaderFixture = loadBinaryFixture('blocks/coinbase.header.bin');
      mockPool
        .intercept({ path: `/v3/blocks/height/5437107`, method: 'GET' })
        .reply(200, blockHeaderFixture, {
          headers: { 'content-type': 'application/octet-stream' },
        });

      const response = await fastify.inject({
        url: '/network/status',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: {
            blockchain: 'stacks',
            network: 'mainnet',
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.deepStrictEqual(json.current_block_identifier, {
        index: 5437107,
        hash: '0x26fd7463e9e0ebf8c24b1abd24cd6a9340aeaf7483f7097b0dfb29f7c7d10124',
      });
      assert.deepStrictEqual(json.genesis_block_identifier, {
        index: 1,
        hash: '0x918697ef63f9d8bdf844c3312b299e72a231cde542f3173f7755bb8c1cdaf3a7',
      });
      assert.deepStrictEqual(json.sync_status, {
        current_index: 5437107,
        synced: mockNodeInfo.is_fully_synced,
      });
      assert.strictEqual(json.current_block_timestamp, 1766362680000);
      assert.deepStrictEqual(json.peers, [
        {
          peer_id: 'peer-hash-1',
          metadata: { ip: '1.2.3.4', port: 20444, peer_version: 402653189, type: ['sample'] },
        },
        {
          peer_id: 'peer-hash-2',
          metadata: { ip: '5.6.7.8', port: 20444, peer_version: 402653189, type: ['inbound'] },
        },
      ]);
    });
  });
});
