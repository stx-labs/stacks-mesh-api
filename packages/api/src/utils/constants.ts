import { OperationStatus } from '@stacks/mesh-serializer';

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

export const OPERATION_STATUSES: OperationStatus[] = [
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

export const OPERATION_TYPES = [
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

export const CALL_METHODS = [
  'contract_call_read_only',
  'contract_get_map_entry',
  'contract_get_data_var',
  'contract_get_constant_val',
  'contract_get_interface',
  'contract_get_source',
];

export const STX_CURRENCY = {
  symbol: 'STX',
  decimals: 6,
};
