import type { NetworkIdentifier, MeshError } from '../api/schemas.js';
import { STACKS_BLOCKCHAIN, MAINNET_NETWORK, TESTNET_NETWORK } from './constants.js';
import { MeshErrors } from './errors.js';

export function validateNetwork(
  networkIdentifier: NetworkIdentifier,
  expectedNetwork: 'mainnet' | 'testnet'
): MeshError | null {
  if (
    networkIdentifier.blockchain !== STACKS_BLOCKCHAIN ||
    (networkIdentifier.network !== MAINNET_NETWORK &&
      networkIdentifier.network !== TESTNET_NETWORK)
  ) {
    return MeshErrors.networkNotSupported(
      `${networkIdentifier.blockchain}/${networkIdentifier.network}`
    );
  }
  if (networkIdentifier.network !== expectedNetwork) {
    return MeshErrors.networkNotSupported(
      `This node only supports ${expectedNetwork}, got ${networkIdentifier.network}`
    );
  }
  return null;
}
