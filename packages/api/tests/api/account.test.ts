import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { buildApiServer } from '../../src/api/index.js';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { makeTestApiConfig } from './helpers.js';

const TEST_ADDRESS = 'SP3SBQ9PZEMBNBAWTR7FRPE3XK0EFW9JWVX4G80S2';

function makeNodeInfo(overrides?: Record<string, unknown>) {
  return {
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
    genesis_chainstate_hash:
      '0x0000000000000000000000000000000000000000000000000000000000000001',
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
    ...overrides,
  };
}

function makeAccountInfo(overrides?: Record<string, unknown>) {
  return {
    balance: '0x0000000000000000000000003B9ACA00', // 1_000_000_000
    locked: '0x00000000000000000000000000000000', // 0
    unlock_height: 0,
    nonce: 5,
    balance_proof: '',
    nonce_proof: '',
    ...overrides,
  };
}

describe('/account', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    const config = makeTestApiConfig();
    fastify = await buildApiServer(config);
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  describe('/balance', () => {
    test('should return account balance with current block identifier', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      const nodeInfo = makeNodeInfo();
      const accountInfo = makeAccountInfo();

      mockPool
        .intercept({ path: `/v2/accounts/${TEST_ADDRESS}`, method: 'GET' })
        .reply(200, accountInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, nodeInfo, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await fastify.inject({
        url: '/account/balance',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      // Block identifier comes from node info when no block_identifier provided
      assert.deepStrictEqual(json.block_identifier, {
        index: nodeInfo.stacks_tip_height,
        hash: nodeInfo.stacks_tip,
      });

      // Balance in STX
      assert.strictEqual(json.balances.length, 1);
      assert.strictEqual(json.balances[0].value, '1000000000');
      assert.deepStrictEqual(json.balances[0].currency, {
        symbol: 'STX',
        decimals: 6,
      });

      // Metadata
      assert.strictEqual(json.metadata.nonce, 5);
      assert.strictEqual(json.metadata.locked_balance, '0');
      assert.strictEqual(json.metadata.unlock_height, 0);
    });

    test('should use block_identifier hash as tip for historical queries', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      const nodeInfo = makeNodeInfo();
      const accountInfo = makeAccountInfo({ nonce: 3 });

      const historicalHash =
        '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

      // When tip is provided, the RPC call includes ?tip= query param
      mockPool
        .intercept({
          path: `/v2/accounts/${TEST_ADDRESS}?tip=${historicalHash}`,
          method: 'GET',
        })
        .reply(200, accountInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, nodeInfo, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await fastify.inject({
        url: '/account/balance',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
          block_identifier: { index: 140000, hash: historicalHash },
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      // Block identifier comes from the request when provided
      assert.deepStrictEqual(json.block_identifier, {
        index: 140000,
        hash: historicalHash,
      });

      assert.strictEqual(json.metadata.nonce, 3);
    });

    test('should return locked balance in metadata', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      const nodeInfo = makeNodeInfo();
      const accountInfo = makeAccountInfo({
        balance: '0x00000000000000000000001D1A94A200', // 125_000_000_000
        locked: '0x000000000000000000000002540BE400', // 10_000_000_000
        unlock_height: 160000,
        nonce: 42,
      });

      mockPool
        .intercept({ path: `/v2/accounts/${TEST_ADDRESS}`, method: 'GET' })
        .reply(200, accountInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, nodeInfo, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await fastify.inject({
        url: '/account/balance',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      assert.strictEqual(json.balances[0].value, '125000000000');
      assert.strictEqual(json.metadata.locked_balance, '10000000000');
      assert.strictEqual(json.metadata.unlock_height, 160000);
      assert.strictEqual(json.metadata.nonce, 42);
    });

    test('should handle zero balance account', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      const nodeInfo = makeNodeInfo();
      const accountInfo = makeAccountInfo({
        balance: '0x00000000000000000000000000000000',
        nonce: 0,
      });

      mockPool
        .intercept({ path: `/v2/accounts/${TEST_ADDRESS}`, method: 'GET' })
        .reply(200, accountInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, nodeInfo, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await fastify.inject({
        url: '/account/balance',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      assert.strictEqual(json.balances[0].value, '0');
      assert.strictEqual(json.metadata.nonce, 0);
    });

    test('should use stacks_tip_height when block_identifier has hash but no index', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      const nodeInfo = makeNodeInfo({ stacks_tip_height: 200000 });
      const accountInfo = makeAccountInfo();

      const tipHash =
        '0x1111111111111111111111111111111111111111111111111111111111111111';

      mockPool
        .intercept({
          path: `/v2/accounts/${TEST_ADDRESS}?tip=${tipHash}`,
          method: 'GET',
        })
        .reply(200, accountInfo, {
          headers: { 'content-type': 'application/json' },
        });
      mockPool
        .intercept({ path: '/v2/info', method: 'GET' })
        .reply(200, nodeInfo, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await fastify.inject({
        url: '/account/balance',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
          block_identifier: { index: 199000, hash: tipHash },
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      // When block_identifier.hash is set, uses the provided index
      assert.deepStrictEqual(json.block_identifier, {
        index: 199000,
        hash: tipHash,
      });
    });
  });

  describe('/coins', () => {
    test('should return 500 not implemented', async () => {
      const response = await fastify.inject({
        url: '/account/coins',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          account_identifier: { address: TEST_ADDRESS },
          include_mempool: false,
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(response.statusCode, 500);
      const json = JSON.parse(response.body);

      assert.strictEqual(json.code, 901);
      assert.strictEqual(json.message, 'Not implemented');
      assert.ok(json.description.includes('/account/coins is not supported'));
      assert.strictEqual(json.retriable, false);
    });
  });
});
