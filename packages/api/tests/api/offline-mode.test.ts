import * as assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { privateKeyToPublic } from '@stacks/transactions';
import { ApiConfig, buildApiServer } from '../../src/api/index.js';
import { buildStacksNetwork } from '../../src/utils/helpers.js';
import { ContractAbiCache } from '../../src/cache/contract-abi-cache.js';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache.js';

// Offline mode is validated without a node: the config has NO rpcClient, so the caches degrade to
// null and no endpoint can make an outbound call. The mock agent (used elsewhere) isn't needed —
// if any handler tried to reach a node it would fail loudly rather than hit the network.
function makeOfflineConfig(): ApiConfig {
  return {
    mode: 'offline',
    networkName: 'testnet',
    // A non-mainnet chain ID; offline mode gets it from STACKS_CHAIN_ID rather than the node.
    network: buildStacksNetwork('testnet', 0x12345678),
    nodeVersion: 'offline',
    apiVersion: 'test',
    tokenMetadataCache: new TokenMetadataCache({ cacheSize: 10, ttl: 1000 }),
    contractAbiCache: new ContractAbiCache({ cacheSize: 10, ttl: 1000 }),
  };
}

const NETWORK_IDENTIFIER = { blockchain: 'stacks', network: 'testnet' };
const PUBLIC_KEY = `0x${privateKeyToPublic(
  '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'
)}`;

function post(
  fastify: FastifyInstance,
  url: string,
  body: Record<string, unknown> = {}
): Promise<LightMyRequestResponse> {
  return fastify.inject({
    url,
    method: 'POST',
    payload: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('offline mode', () => {
  let fastify: FastifyInstance;

  before(async () => {
    fastify = await buildApiServer(makeOfflineConfig());
  });

  test('serves /network/list and /network/options', async () => {
    const list = await post(fastify, '/network/list');
    assert.equal(list.statusCode, 200);
    assert.deepEqual(JSON.parse(list.body).network_identifiers, [
      { blockchain: 'stacks', network: 'testnet' },
    ]);

    const options = await post(fastify, '/network/options', {
      network_identifier: NETWORK_IDENTIFIER,
    });
    assert.equal(options.statusCode, 200);
    // node_version reflects the offline sentinel, not a node.
    assert.equal(JSON.parse(options.body).version.node_version, 'offline');
  });

  test('serves the offline construction endpoints (derive) without a node', async () => {
    const res = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    assert.equal(res.statusCode, 200);
    // Address format follows the network label (testnet) regardless of the custom chain ID.
    assert.match(JSON.parse(res.body).account_identifier.address, /^ST/);
  });

  test('does not serve node-backed endpoints (404)', async () => {
    const nodeBackedEndpoints = [
      '/network/status',
      '/construction/metadata',
      '/construction/submit',
      '/account/balance',
      '/block',
      '/mempool',
      '/call',
    ];
    for (const url of nodeBackedEndpoints) {
      const res = await post(fastify, url, { network_identifier: NETWORK_IDENTIFIER });
      assert.equal(res.statusCode, 404, `${url} should be unavailable (404) in offline mode`);
    }
  });
});
