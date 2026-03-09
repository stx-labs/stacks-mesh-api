import path from 'node:path';
import fs from 'node:fs';
import { ApiConfig } from '../../src/api';
import { ContractAbiCache } from '../../src/cache/contract-abi-cache';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache';
import { StacksRpcClient } from '../../src/stacks-rpc/stacks-rpc-client';

export function makeTestApiConfig(): ApiConfig {
  const rpcClient = new StacksRpcClient({
    hostname: 'test.stacks.node',
    port: 20444,
    authToken: 'test-token',
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
