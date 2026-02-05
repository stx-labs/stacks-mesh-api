import { ErrorResponse, NetworkIdentifier } from '@stacks/mesh-serializer';
import { MeshErrors } from './errors.js';

// Mesh API version
export const MESH_VERSION = '1.4.15';

const enum StacksNetworkId {
  mainnet = 0x00000001,
  testnet = 0x80000000,
}
export function getStacksNetwork(networkId: number): 'mainnet' | 'testnet' {
  switch (networkId) {
    case StacksNetworkId.mainnet:
      return 'mainnet';
    case StacksNetworkId.testnet:
      return 'testnet';
    default:
      throw new Error(`Unknown network ID: ${networkId}`);
  }
}

/**
 * Validates that the network identifier from the request matches the configured network
 * @param networkIdentifier - The network identifier from the request
 * @param configNetwork - The network from the RouteConfig
 * @returns ErrorResponse if validation fails, undefined if validation succeeds
 */
export function validateNetwork(
  networkIdentifier: NetworkIdentifier,
  configNetwork: 'mainnet' | 'testnet'
): ErrorResponse | undefined {
  if (networkIdentifier.blockchain !== 'stacks') {
    return MeshErrors.networkNotSupported(networkIdentifier.blockchain);
  }

  if (networkIdentifier.network !== configNetwork) {
    return MeshErrors.networkNotSupported(
      `${networkIdentifier.blockchain}/${networkIdentifier.network} (expected stacks/${configNetwork})`
    );
  }

  return undefined;
}
