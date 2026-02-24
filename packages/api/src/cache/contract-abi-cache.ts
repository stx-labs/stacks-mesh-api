import { LRUCache } from 'lru-cache';
import { StacksRpcClient } from '../stacks-rpc/stacks-rpc-client.js';
import { ClarityAbi } from '@stacks/transactions';

/**
 * Cache for contract ABIs. This is used to avoid making repeated calls to the Stacks node looking
 * for contract ABIs.
 */
export class ContractAbiCache {
  private readonly rpcClient: StacksRpcClient;
  private readonly cache: LRUCache<string, ClarityAbi>;

  constructor(args: { rpcClient: StacksRpcClient; cacheSize: number; ttl: number }) {
    const { rpcClient, cacheSize, ttl } = args;
    this.rpcClient = rpcClient;
    this.cache = new LRUCache<string, ClarityAbi>({
      max: cacheSize,
      ttl: ttl,
      allowStale: true,
    });
  }

  async get(contractIdentifier: string): Promise<ClarityAbi | null> {
    const cachedAbi = this.cache.get(contractIdentifier);
    if (cachedAbi) return cachedAbi;
    const abi = await this.fetchAbi(contractIdentifier);
    if (abi) {
      this.cache.set(contractIdentifier, abi);
      return abi;
    }
    return null;
  }

  private async fetchAbi(contractIdentifier: string): Promise<ClarityAbi | undefined> {
    const parts = contractIdentifier.split('.');
    const contractAddress = parts[0];
    const contractName = parts[1].split('::')[0];
    const abi = await this.rpcClient.getContractInterface(contractAddress, contractName);
    return abi;
  }
}
