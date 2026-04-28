import path from 'node:path';
import fs from 'node:fs';
import { fetch as undiciFetch, MockAgent } from 'undici';
import { ApiConfig } from '../../src/api';
import { ContractAbiCache } from '../../src/cache/contract-abi-cache';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache';
import { createCoreRpcClient } from '@stacks/rpc-client';

export function makeTestApiConfig(getMockAgent: () => MockAgent): ApiConfig {
  const mockFetch = ((input: any, init?: any) => {
    if (input instanceof Request) {
      return undiciFetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        duplex: input.body != null ? 'half' : undefined,
        ...init,
        dispatcher: getMockAgent(),
      });
    }
    return undiciFetch(input, { ...init, dispatcher: getMockAgent() });
  }) as typeof globalThis.fetch;
  const rpcClient = createCoreRpcClient({
    baseUrl: 'http://test.stacks.node:20444',
    authToken: 'test-token',
    fetch: mockFetch,
  });
  const tokenMetadataCache = new TokenMetadataCache({
    rpcClient,
    cacheSize: 100,
    ttl: 60_000,
  });
  const contractAbiCache = new ContractAbiCache({
    rpcClient,
    cacheSize: 100,
    ttl: 60_000,
  });
  return {
    rpcClient,
    network: 'mainnet',
    nodeVersion: '1.0.0',
    apiVersion: '1.0.0',
    tokenMetadataCache,
    contractAbiCache,
  };
}

export const FIXTURES_DIR = new URL('./fixtures', import.meta.url).pathname;

export function loadFixture(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8'));
}

export function loadBinaryFixture(relativePath: string) {
  return fs.readFileSync(path.join(FIXTURES_DIR, relativePath));
}
