import { ErrorResponse, NetworkIdentifier, OperationStatus } from '@stacks/mesh-serializer';
import { MeshErrors } from './errors.js';

export const MESH_SPECIFICATION_VERSION = '1.5.1';

const enum StacksNetworkId {
  mainnet = 0x00000001,
  testnet = 0x80000000,
}

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

export const MESH_OPERATION_STATUSES: OperationStatus[] = [
  {
    status: 'success',
    successful: true,
  },
  {
    status: 'abort_by_response',
    successful: false,
  },
  {
    status: 'abort_by_post_condition',
    successful: false,
  },
  {
    status: 'dropped_replace_by_fee',
    successful: false,
  },
  {
    status: 'dropped_replace_across_fork',
    successful: false,
  },
  {
    status: 'dropped_too_expensive',
    successful: false,
  },
  {
    status: 'dropped_problematic',
    successful: false,
  },
  {
    status: 'dropped_stale_garbage_collect',
    successful: false,
  },
];

export const MESH_OPERATION_TYPES = [
  'coinbase',
  'fee',
  'token_transfer',
  'token_mint',
  'token_burn',
  'contract_call',
  'contract_deploy',
  'tenure_change',
  'poison_microblock',
  'stx_lock',
  'contract_log',
];

export const MESH_CALL_METHODS = ['token_transfer', 'smart_contract', 'contract_call'];
