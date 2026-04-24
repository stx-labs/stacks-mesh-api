import { StacksNetworkId } from './constants.js';

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
