import codec from '@stacks/codec';
import { StacksRpcClient } from '../stacks-rpc/stacks-rpc-client.js';
import { StacksNetworkId } from './constants.js';
import { StacksNodeInfo } from '../stacks-rpc/types.js';

/**
 * Get the chain tip Nakamoto block from the RPC client.
 * @param rpcClient - The RPC client.
 * @returns The chain tip Nakamoto block.
 */
export async function getChainTipNakamotoBlock(
  rpcClient: StacksRpcClient
): Promise<{ decodedBlock: codec.DecodedNakamotoBlockResult; nodeInfo: StacksNodeInfo }> {
  // Node info does not contain the index block hash, so we need a secondary request to fetch it
  // from the nakamoto block at the chain tip height.
  const nodeInfo = await rpcClient.getInfo();
  const blockBytes = await rpcClient.getNakamotoBlockByHeight(nodeInfo.stacks_tip_height);
  return {
    decodedBlock: codec.decodeNakamotoBlock(blockBytes),
    nodeInfo,
  };
}

/**
 * Get the Stacks network name from the network ID.
 * @param networkId - The network ID.
 * @returns The Stacks network name.
 */
export function getStacksNetworkName(networkId: number): 'mainnet' | 'testnet' {
  switch (networkId) {
    case StacksNetworkId.mainnet:
      return 'mainnet';
    case StacksNetworkId.testnet:
      return 'testnet';
    default:
      throw new Error(`Unknown network ID: ${networkId}`);
  }
}
