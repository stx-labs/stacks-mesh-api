import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { MockAgent } from 'undici';
import { buildApiServer } from '../../src/api/index.js';
import { loadBinaryFixture, loadFixture, makeTestApiConfig } from './helpers.js';

// The coinbase fixture + its decoded header expose both hashes:
//   index_block_hash (block_id) = 0x26fd7463…   block_hash = 0xe38b02c7…   height = 5437107
const fixture = loadFixture('blocks/coinbase.json');
const INDEX_BLOCK_HASH = `0x${fixture.block_id}`;
const BLOCK_HASH = `0x${fixture.block_hash}`;
const PARENT_INDEX_BLOCK_HASH = fixture.parent_block_id;
const HEIGHT = fixture.block_height;
const HEADER_BIN = 'blocks/coinbase.header.bin';

const ADDRESS = 'SP3SBQ9PZEMBNBAWTR7FRPE3XK0EFW9JWVX4G80S2';

function nodeInfo() {
  return {
    server_version: 'stacks-node 3.0.0',
    network_id: 1,
    parent_network_id: 1,
    stacks_tip_height: HEIGHT,
    stacks_tip: '0xabcd',
    is_fully_synced: true,
  };
}

function post(fastify: FastifyInstance, url: string, body: Record<string, unknown>) {
  return fastify.inject({
    url,
    method: 'POST',
    payload: JSON.stringify({
      network_identifier: { blockchain: 'stacks', network: 'mainnet' },
      ...body,
    }),
    headers: { 'content-type': 'application/json' },
  });
}

const headerReply = { headers: { 'content-type': 'application/octet-stream' } };
const jsonReply = { headers: { 'content-type': 'application/json' } };

describe('block hash mode = block_hash', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;
  let mockPool: ReturnType<MockAgent['get']>;

  beforeEach(async () => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    const config = makeTestApiConfig(() => mockAgent);
    config.blockHashMode = 'block_hash';
    fastify = await buildApiServer(config);
    mockPool = mockAgent.get('http://test.stacks.node:20444');
  });

  afterEach(() => mockAgent.close());

  test('/block displays block_hash for the block and its parent', async () => {
    // index → height fetch (resolve index_block_hash) → replay → parent header fetch (for its block_hash)
    mockPool
      .intercept({ path: `/v3/blocks/height/${HEIGHT}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);
    mockPool
      .intercept({ path: `/v3/blocks/replay/${fixture.block_id}`, method: 'GET' })
      .reply(200, fixture, jsonReply);
    mockPool
      .intercept({ path: `/v3/blocks/${PARENT_INDEX_BLOCK_HASH}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);

    const res = await post(fastify, '/block', { block_identifier: { index: HEIGHT } });
    assert.equal(res.statusCode, 200);
    const { block } = JSON.parse(res.body);
    assert.equal(block.block_identifier.hash, BLOCK_HASH);
    assert.equal(block.block_identifier.index, HEIGHT);
    // Parent hash is the parent header's block_hash (fetched separately), not its index block hash.
    assert.equal(block.parent_block_identifier.hash, BLOCK_HASH);
  });

  test('/block rejects a hash-only lookup (node cannot resolve a bare block_hash)', async () => {
    const res = await post(fastify, '/block', { block_identifier: { hash: BLOCK_HASH } });
    assert.equal(res.statusCode, 500);
    const json = JSON.parse(res.body);
    assert.equal(json.code, 102); // INVALID_BLOCK_IDENTIFIER
    assert.match(json.description, /must also include the block index/);
  });

  test('/block rejects an index + mismatched hash', async () => {
    mockPool
      .intercept({ path: `/v3/blocks/height/${HEIGHT}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);
    const res = await post(fastify, '/block', {
      block_identifier: { index: HEIGHT, hash: '0xdeadbeef' },
    });
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.parse(res.body).code, 102);
  });

  test('/block accepts an index + matching block_hash', async () => {
    mockPool
      .intercept({ path: `/v3/blocks/height/${HEIGHT}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);
    mockPool
      .intercept({ path: `/v3/blocks/replay/${fixture.block_id}`, method: 'GET' })
      .reply(200, fixture, jsonReply);
    mockPool
      .intercept({ path: `/v3/blocks/${PARENT_INDEX_BLOCK_HASH}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);

    const res = await post(fastify, '/block', {
      block_identifier: { index: HEIGHT, hash: BLOCK_HASH },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).block.block_identifier.hash, BLOCK_HASH);
  });

  test('/account displays block_hash but still queries the node tip by index_block_hash', async () => {
    mockPool.intercept({ path: '/v2/info', method: 'GET' }).reply(200, nodeInfo(), jsonReply);
    mockPool
      .intercept({ path: `/v3/blocks/height/${HEIGHT}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);
    // The tip MUST be the index_block_hash — if the code sent the block_hash this mock wouldn't match.
    mockPool
      .intercept({ path: `/v2/accounts/${ADDRESS}?proof=0&tip=${INDEX_BLOCK_HASH}`, method: 'GET' })
      .reply(200, { balance: '1000', locked: '0', nonce: 1, unlock_height: 0 }, jsonReply);

    const res = await post(fastify, '/account/balance', {
      account_identifier: { address: ADDRESS },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).block_identifier.hash, BLOCK_HASH);
  });

  test('/network/status displays block_hash for the current block', async () => {
    mockPool.intercept({ path: '/v2/info', method: 'GET' }).reply(200, nodeInfo(), jsonReply);
    mockPool
      .intercept({ path: '/v2/neighbors', method: 'GET' })
      .reply(200, { bootstrap: [], sample: [], inbound: [], outbound: [] }, jsonReply);
    mockPool
      .intercept({ path: `/v3/blocks/height/${HEIGHT}`, method: 'GET' })
      .reply(200, loadBinaryFixture(HEADER_BIN), headerReply);

    const res = await post(fastify, '/network/status', {});
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).current_block_identifier.hash, BLOCK_HASH);
  });
});
