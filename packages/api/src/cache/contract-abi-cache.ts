import { LRUCache } from 'lru-cache';
import { ClarityAbi } from '@stacks/transactions';
import { CoreRpcClient } from '@stacks/rpc-client';

/**
 * Cache for contract ABIs. This is used to avoid making repeated calls to the Stacks node looking
 * for contract ABIs.
 */
export class ContractAbiCache {
  private readonly rpcClient: CoreRpcClient;
  private readonly cache: LRUCache<string, ClarityAbi>;

  constructor(args: { rpcClient: CoreRpcClient; cacheSize: number; ttl: number }) {
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
    try {
      const abi = await this.fetchAbi(contractIdentifier);
      if (abi) {
        this.cache.set(contractIdentifier, abi);
        return abi;
      }
    } catch {
      // ABI fetch failed (e.g. contract not found), return null.
    }
    return null;
  }

  private async fetchAbi(contractIdentifier: string): Promise<ClarityAbi | undefined> {
    const parts = contractIdentifier.split('.');
    const contractAddress = parts[0];
    const contractName = parts[1].split('::')[0];
    const abi = await this.rpcClient.request(
      'GET',
      '/v2/contracts/interface/{deployer_address}/{contract_name}',
      {
        params: {
          path: { deployer_address: contractAddress, contract_name: contractName },
        },
      }
    );
    return abi as ClarityAbi;
  }
}
