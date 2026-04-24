import { LRUCache } from 'lru-cache';
import { CoreRpcClient } from '@stacks/rpc-client';
import { readStringFromContract, readUIntFromContract } from '../stacks-rpc/helpers.js';

export type TokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
};

/**
 * Cache for fungible token metadata. This is used to avoid making repeated calls to the Stacks node
 * looking for FT symbols, names and decimals.
 */
export class TokenMetadataCache {
  private readonly rpcClient: CoreRpcClient;
  private readonly cache: LRUCache<string, TokenMetadata>;

  constructor(args: { rpcClient: CoreRpcClient; cacheSize: number; ttl: number }) {
    const { rpcClient, cacheSize, ttl } = args;
    this.rpcClient = rpcClient;
    this.cache = new LRUCache<string, TokenMetadata>({
      max: cacheSize,
      ttl: ttl,
      allowStale: true,
    });
  }

  async get(assetIdentifier: string): Promise<TokenMetadata | null> {
    const key = assetIdentifier;
    const cachedMetadata = this.cache.get(key);
    if (!cachedMetadata) {
      const metadata = await this.fetchMetadata(key);
      if (metadata) {
        this.cache.set(key, metadata);
        return metadata;
      }
      return null;
    }
    return cachedMetadata ?? null;
  }

  private async fetchMetadata(assetIdentifier: string): Promise<TokenMetadata | undefined> {
    const parts = assetIdentifier.split('.');
    const contractAddress = parts[0];
    const contractName = parts[1].split('::')[0];
    const [name, symbol, decimals] = await Promise.all([
      readStringFromContract(
        this.rpcClient,
        contractAddress,
        contractName,
        'get-name',
        contractAddress
      ),
      readStringFromContract(
        this.rpcClient,
        contractAddress,
        contractName,
        'get-symbol',
        contractAddress,
        []
      ),
      readUIntFromContract(
        this.rpcClient,
        contractAddress,
        contractName,
        'get-decimals',
        contractAddress
      ),
    ]);
    return {
      name,
      symbol,
      decimals,
    };
  }
}
