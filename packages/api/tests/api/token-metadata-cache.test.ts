import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CoreRpcClient } from '@stacks/rpc-client';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache.js';

const ASSET = 'SP000000000000000000002Q6VF78.some-token::some-token';

function cacheWithRpc(request: () => Promise<unknown>): TokenMetadataCache {
  return new TokenMetadataCache({
    rpcClient: { request } as unknown as CoreRpcClient,
    cacheSize: 10,
    ttl: 1000,
  });
}

describe('TokenMetadataCache.get resilience', () => {
  test('returns null (does not throw) when a read-only call rejects', async () => {
    // A non-standard token whose get-* functions reject a 0-arg call — the node replies okay:false,
    // which callReadOnlyFunction turns into a thrown error. get() must swallow it so one bad token
    // does not fail the whole block serialization.
    const cache = cacheWithRpc(async () => ({
      okay: false,
      cause: 'RuntimeCheck(IncorrectArgumentCount(1, 0))',
    }));
    assert.equal(await cache.get(ASSET), null);
  });

  test('returns null when the node request throws', async () => {
    const cache = cacheWithRpc(async () => {
      throw new Error('network down');
    });
    assert.equal(await cache.get(ASSET), null);
  });

  test('returns null without a node (offline)', async () => {
    const cache = new TokenMetadataCache({ cacheSize: 10, ttl: 1000 });
    assert.equal(await cache.get(ASSET), null);
  });
});
