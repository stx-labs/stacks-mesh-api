import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from '@stacks/network';
import { StacksNetworkId } from './constants.js';

export type StacksNetworkName = 'mainnet' | 'testnet';

/**
 * Resolve the network *label* for a connected node. The label selects the address version bytes,
 * the PoX boot address, and the value requests are validated against — all of which are identical
 * across every testnet regardless of its chain ID.
 *
 * The canonical mainnet chain ID maps to `mainnet`; every other value — the canonical testnet ID
 * or any custom/private testnet/devnet ID — maps to `testnet`, since mainnet has exactly one fixed
 * chain ID.
 * @param networkId - The node's chain ID (`/v2/info` `network_id`).
 * @returns The Stacks network name.
 */
export function getStacksNetworkName(networkId: number): StacksNetworkName {
  return networkId === StacksNetworkId.mainnet ? 'mainnet' : 'testnet';
}

/**
 * Build the {@link StacksNetwork} used for transaction construction and signing. The address/tx
 * format comes from `networkName`, but the chain ID is taken from the node's actual `network_id`
 * rather than the hardcoded mainnet/testnet constant — this is what allows signing to work against
 * a node running a custom chain ID (the chain ID is folded into the pre-sign sighash).
 * @param networkName - The resolved network format.
 * @param chainId - The node's chain ID (`/v2/info` `network_id`).
 * @returns The Stacks network object with the node's chain ID.
 */
export function buildStacksNetwork(
  networkName: StacksNetworkName,
  chainId: number
): StacksNetwork {
  const base = networkName === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
  return { ...base, chainId };
}
