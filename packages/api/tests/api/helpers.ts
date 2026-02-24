import { ApiConfig } from "../../src/api";
import { ContractAbiCache } from "../../src/cache/contract-abi-cache";
import { TokenMetadataCache } from "../../src/cache/token-metadata-cache";
import { StacksRpcClient } from "../../src/stacks-rpc/stacks-rpc-client";

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
    network: 'testnet',
    nodeVersion: '1.0.0',
    tokenMetadataCache,
    contractAbiCache,
  };
}
