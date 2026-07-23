import { LRUCache } from 'lru-cache';
import { logger } from '@stacks/api-toolkit';
import { CoreRpcClient } from '@stacks/rpc-client';
import { readStringFromContract, readUIntFromContract } from '../stacks-rpc/helpers.js';

export type TokenMetadata = {
  // `name` is optional because it's fetched independently and may be unavailable for a
  // non-standard token even when the symbol/decimals resolve.
  name?: string;
  symbol: string;
  decimals: number;
};

/**
 * A symbol to display when the contract's `get-symbol` can't be read. Uses the asset name (the part
 * after `::` in the asset identifier, i.e. the Clarity fungible-token name), falling back to the
 * contract name. Better than a blank symbol for non-standard tokens.
 */
function fallbackSymbol(assetIdentifier: string): string {
  const assetName = assetIdentifier.split('::')[1];
  if (assetName) return assetName;
  return assetIdentifier.split('.')[1] ?? '';
}

/**
 * Cache for fungible token metadata. This is used to avoid making repeated calls to the Stacks node
 * looking for FT symbols, names and decimals.
 */
export class TokenMetadataCache {
  // Absent in offline mode: `get` then resolves to `null` without any node call.
  private readonly rpcClient?: CoreRpcClient;
  private readonly cache: LRUCache<string, TokenMetadata>;

  constructor(args: { rpcClient?: CoreRpcClient; cacheSize: number; ttl: number }) {
    const { rpcClient, cacheSize, ttl } = args;
    this.rpcClient = rpcClient;
    this.cache = new LRUCache<string, TokenMetadata>({
      max: cacheSize,
      ttl: ttl,
      allowStale: true,
    });
  }

  async get(assetIdentifier: string): Promise<TokenMetadata | null> {
    // No node connection (offline mode) — cannot resolve token metadata.
    if (!this.rpcClient) return null;
    const cached = this.cache.get(assetIdentifier);
    if (cached) return cached;
    try {
      const { metadata, complete } = await this.fetchMetadata(assetIdentifier);
      // Only cache fully-resolved metadata. Partial/fallback results are left uncached so a
      // transient read failure recovers on the next request rather than being pinned for the TTL.
      if (complete) this.cache.set(assetIdentifier, metadata);
      return metadata;
    } catch (error) {
      // `fetchMetadata` degrades to fallbacks rather than throwing, but guard against any
      // unexpected synchronous throw (e.g. a malformed asset identifier) so one bad token can never
      // fail block serialization.
      logger.debug(
        {
          asset_identifier: assetIdentifier,
          error: error instanceof Error ? error.message : String(error),
        },
        'Token metadata lookup failed unexpectedly; using fallback symbol'
      );
      return { symbol: fallbackSymbol(assetIdentifier), decimals: 0 };
    }
  }

  /**
   * Fetch a token's name, symbol and decimals from its SIP-010 read-only getters. Each getter is
   * resolved independently (`Promise.allSettled`), so one missing/incompatible function no longer
   * discards the fields that did resolve. Failures degrade to fallbacks (derived symbol, no name, 0
   * decimals) and are logged; `complete` is true only when every getter succeeded.
   */
  private async fetchMetadata(
    assetIdentifier: string
  ): Promise<{ metadata: TokenMetadata; complete: boolean }> {
    // `get` guarantees an rpcClient before calling this.
    const rpcClient = this.rpcClient!;
    const parts = assetIdentifier.split('.');
    const contractAddress = parts[0];
    const contractName = parts[1].split('::')[0];

    const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
      readStringFromContract(rpcClient, contractAddress, contractName, 'get-name', contractAddress),
      readStringFromContract(
        rpcClient,
        contractAddress,
        contractName,
        'get-symbol',
        contractAddress,
        []
      ),
      readUIntFromContract(
        rpcClient,
        contractAddress,
        contractName,
        'get-decimals',
        contractAddress
      ),
    ]);

    const failures: Record<string, string> = {};
    const valueOf = <T>(result: PromiseSettledResult<T>, fn: string): T | undefined => {
      if (result.status === 'fulfilled') return result.value;
      failures[fn] = result.reason instanceof Error ? result.reason.message : String(result.reason);
      return undefined;
    };

    const name = valueOf(nameResult, 'get-name');
    const symbol = valueOf(symbolResult, 'get-symbol');
    const decimals = valueOf(decimalsResult, 'get-decimals');

    const complete = Object.keys(failures).length === 0;
    if (!complete) {
      logger.debug(
        { asset_identifier: assetIdentifier, failures },
        'Incomplete token metadata; using fallbacks'
      );
    }

    return {
      metadata: {
        name,
        symbol: symbol ?? fallbackSymbol(assetIdentifier),
        decimals: decimals ?? 0,
      },
      complete,
    };
  }
}
