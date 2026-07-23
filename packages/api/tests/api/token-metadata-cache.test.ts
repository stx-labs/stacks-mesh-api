import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CoreRpcClient } from '@stacks/rpc-client';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache.js';

const ASSET =
  'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-stx-usdcx-v-2-bps-10::pool-token';

function cacheWithRpc(request: (...args: unknown[]) => Promise<unknown>): TokenMetadataCache {
  return new TokenMetadataCache({
    rpcClient: { request } as unknown as CoreRpcClient,
    cacheSize: 10,
    ttl: 1000,
  });
}

describe('TokenMetadataCache.get resilience', () => {
  test('degrades to a derived symbol (does not throw) when the read-only calls reject', async () => {
    // A non-standard token whose get-* functions reject a 0-arg call — the node replies okay:false,
    // which callReadOnlyFunction turns into a thrown error. All three getters fail, so we fall back
    // to the asset name for the symbol rather than blanking it or failing the whole block.
    const cache = cacheWithRpc(async () => ({
      okay: false,
      cause: 'RuntimeCheck(IncorrectArgumentCount(1, 0))',
    }));
    const metadata = await cache.get(ASSET);
    assert.deepEqual(metadata, { name: undefined, symbol: 'pool-token', decimals: 0 });
  });

  test('degrades to a derived symbol when the node request throws', async () => {
    const cache = cacheWithRpc(async () => {
      throw new Error('network down');
    });
    const metadata = await cache.get(ASSET);
    assert.equal(metadata?.symbol, 'pool-token');
    assert.equal(metadata?.decimals, 0);
  });

  test('does not cache incomplete results (retries on the next request)', async () => {
    let calls = 0;
    const cache = cacheWithRpc(async () => {
      calls++;
      return { okay: false, cause: 'boom' };
    });
    await cache.get(ASSET);
    const afterFirst = calls;
    await cache.get(ASSET);
    // A cached result would have served the second call with no new requests.
    assert.ok(calls > afterFirst, 'expected the fetch to be retried, not served from cache');
  });

  test('does not throw on a malformed asset identifier (synchronous parse failure)', async () => {
    // No '.' → the internal parse would throw before any promise is created; get() must still
    // resolve to a fallback rather than letting it bubble up and fail block serialization.
    const cache = cacheWithRpc(async () => ({ okay: false, cause: 'boom' }));
    const metadata = await cache.get('not-a-valid-asset-identifier');
    assert.equal(metadata?.decimals, 0);
    assert.equal(typeof metadata?.symbol, 'string');
  });

  test('returns null without a node (offline)', async () => {
    const cache = new TokenMetadataCache({ cacheSize: 10, ttl: 1000 });
    assert.equal(await cache.get(ASSET), null);
  });
});
