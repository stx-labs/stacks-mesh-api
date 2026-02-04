import type { NetworkIdentifier, OperationStatus } from '../types/mesh.js';
import { STX_CURRENCY } from '@stacks/mesh-serializer';

// Re-export STX_CURRENCY from the serializer package
export { STX_CURRENCY } from '@stacks/mesh-serializer';

// Stacks blockchain constants
export const STACKS_BLOCKCHAIN = 'stacks';
export const STACKS_DECIMALS = 6;
export const STACKS_SYMBOL = 'STX';

// Supported networks
export const MAINNET_NETWORK = 'mainnet';
export const TESTNET_NETWORK = 'testnet';

// Default network identifiers
export const MAINNET_IDENTIFIER: NetworkIdentifier = {
  blockchain: STACKS_BLOCKCHAIN,
  network: MAINNET_NETWORK,
};

export const TESTNET_IDENTIFIER: NetworkIdentifier = {
  blockchain: STACKS_BLOCKCHAIN,
  network: TESTNET_NETWORK,
};

// Mesh API version
export const MESH_VERSION = '1.4.15';

// Operation types supported by Stacks
export const OPERATION_TYPES = [
  'transfer',
  'fee',
  'coinbase',
  'stx_lock',
  'stx_unlock',
  'stx_mint',
  'stx_burn',
  'contract_call',
  'smart_contract',
  'token_transfer',
  'tenure_change',
  'poison_microblock',
  'ft_transfer',
  'ft_mint',
  'ft_burn',
  'nft_transfer',
  'nft_mint',
  'nft_burn',
] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

// Operation statuses
export const OPERATION_STATUSES: OperationStatus[] = [
  { status: 'success', successful: true },
  { status: 'pending', successful: false },
  { status: 'abort_by_response', successful: false },
  { status: 'abort_by_post_condition', successful: false },
];

// Call methods supported via /call endpoint
export const CALL_METHODS = [
  'get_stx_balance',
  'get_nonce',
  'get_contract_info',
  'call_read_only_function',
  'get_data_var',
  'get_map_entry',
  'get_pox_info',
  'estimate_fee',
] as const;

export type CallMethod = (typeof CALL_METHODS)[number];

// Supported signature types for Stacks
export const SUPPORTED_CURVE_TYPES = ['secp256k1'] as const;
export const SUPPORTED_SIGNATURE_TYPES = ['ecdsa_recovery'] as const;

// Genesis block info (will be populated from node)
export const MAINNET_GENESIS_BLOCK_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const MAINNET_GENESIS_BLOCK_INDEX = 0;

export const TESTNET_GENESIS_BLOCK_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const TESTNET_GENESIS_BLOCK_INDEX = 0;
