import { OperationStatus } from '../../../schemas/dist/index.js';

export const MESH_SPECIFICATION_VERSION = '1.5.1';

export const enum StacksNetworkId {
  mainnet = 0x00000001,
  testnet = 0x80000000,
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
  'handle-unlock',
  'stack-stx',
  'stack-increase',
  'stack-extend',
  'delegate-stx',
  'delegate-stack-stx',
  'delegate-stack-increase',
  'delegate-stack-extend',
  'stack-aggregation-commit',
  'stack-aggregation-commit-indexed',
  'stack-aggregation-increase',
  'revoke-delegate-stx',
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

const BOOT_ADDR_MAINNET = 'SP000000000000000000002Q6VF78';
const BOOT_ADDR_TESTNET = 'ST000000000000000000002AMW42H';

const POX_1_CONTRACT_NAME = 'pox';
const POX_2_CONTRACT_NAME = 'pox-2';
const POX_3_CONTRACT_NAME = 'pox-3';
const POX_4_CONTRACT_NAME = 'pox-4';
const POX_5_CONTRACT_NAME = 'pox-5';

export const PoxContractIdentifier = {
  pox1: {
    mainnet: `${BOOT_ADDR_MAINNET}.${POX_1_CONTRACT_NAME}`,
    testnet: `${BOOT_ADDR_TESTNET}.${POX_1_CONTRACT_NAME}`,
  },
  pox2: {
    mainnet: `${BOOT_ADDR_MAINNET}.${POX_2_CONTRACT_NAME}`,
    testnet: `${BOOT_ADDR_TESTNET}.${POX_2_CONTRACT_NAME}`,
  },
  pox3: {
    mainnet: `${BOOT_ADDR_MAINNET}.${POX_3_CONTRACT_NAME}`,
    testnet: `${BOOT_ADDR_TESTNET}.${POX_3_CONTRACT_NAME}`,
  },
  pox4: {
    mainnet: `${BOOT_ADDR_MAINNET}.${POX_4_CONTRACT_NAME}`,
    testnet: `${BOOT_ADDR_TESTNET}.${POX_4_CONTRACT_NAME}`,
  },
  pox5: {
    mainnet: `${BOOT_ADDR_MAINNET}.${POX_5_CONTRACT_NAME}`,
    testnet: `${BOOT_ADDR_TESTNET}.${POX_5_CONTRACT_NAME}`,
  },
} as const;

export const PoxContractIdentifiers = Object.values(PoxContractIdentifier).flatMap(
  Object.values
) as string[];

// Genesis block identifiers per network. `index_block_hash` is the default display; `block_hash`
// is shown when BLOCK_HASH_MODE=block_hash.
// TODO: the testnet `block_hash` is a placeholder (matching the placeholder index hash) — set a
//       real value if testnet genesis is needed in block_hash mode.
export const GENESIS_BLOCK_HASH = {
  mainnet: {
    index_block_hash: '0x918697ef63f9d8bdf844c3312b299e72a231cde542f3173f7755bb8c1cdaf3a7',
    block_hash: '0x6b2c809627f2fd19991d8eb6ae034cb4cce1e1fc714aa77351506b5af1f8248e',
  },
  testnet: {
    index_block_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    block_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
} as const;

export const GENESIS_BLOCK_TIMESTAMP = 1610645304000;
