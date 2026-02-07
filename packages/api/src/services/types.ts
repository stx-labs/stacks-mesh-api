// Stacks RPC Types based on stacks-core OpenAPI specification

export interface StacksNodeInfo {
  peer_version: number;
  pox_consensus: string;
  burn_block_height: number;
  stable_pox_consensus: string;
  stable_burn_block_height: number;
  server_version: string;
  network_id: number;
  parent_network_id: number;
  stacks_tip_height: number;
  stacks_tip: string;
  stacks_tip_consensus_hash: string;
  genesis_chainstate_hash: string;
  unanchored_tip: string | null;
  unanchored_seq: number | null;
  tenure_height: number;
  exit_at_block_height: number | null;
  is_fully_synced: boolean;
  node_public_key: string;
  node_public_key_hash: string;
  last_pox_anchor: {
    anchor_block_hash: string;
    anchor_block_txid: string;
  };
  stackerdbs: string[];
}

export interface StacksPoxInfo {
  contract_id: string;
  pox_activation_threshold_ustx: number;
  first_burnchain_block_height: number;
  current_burnchain_block_height: number;
  prepare_phase_block_length: number;
  reward_phase_block_length: number;
  reward_slots: number;
  rejection_fraction: number;
  total_liquid_supply_ustx: number;
  current_cycle: {
    id: number;
    min_threshold_ustx: number;
    stacked_ustx: number;
    is_pox_active: boolean;
  };
  next_cycle: {
    id: number;
    min_threshold_ustx: number;
    min_increment_ustx: number;
    stacked_ustx: number;
    prepare_phase_start_block_height: number;
    blocks_until_prepare_phase: number;
    reward_phase_start_block_height: number;
    blocks_until_reward_phase: number;
    ustx_until_pox_rejection: number;
  };
  epochs: StacksEpoch[];
  min_amount_ustx: number;
  prepare_cycle_length: number;
  reward_cycle_id: number;
  reward_cycle_length: number;
  rejection_votes_left_required: number;
  next_reward_cycle_in: number;
  contract_versions: {
    contract_id: string;
    activation_burnchain_block_height: number;
    first_reward_cycle_id: number;
  }[];
}

export interface StacksEpoch {
  epoch_id: string;
  start_height: number;
  end_height: number;
  block_limit: {
    write_length: number;
    write_count: number;
    read_length: number;
    read_count: number;
    runtime: number;
  };
  network_epoch: number;
}

export interface StacksAccountInfo {
  balance: string;
  locked: string;
  unlock_height: number;
  nonce: number;
  balance_proof?: string;
  nonce_proof?: string;
}

export interface StacksBlock {
  block_hash: string;
  index_block_hash: string;
  parent_block_hash: string;
  parent_index_block_hash: string;
  parent_microblock_hash: string;
  parent_microblock_sequence: number;
  block_height: number;
  burn_block_time: number;
  burn_block_time_iso: string;
  burn_block_hash: string;
  burn_block_height: number;
  miner_txid: string;
  tx_count: number;
  execution_cost_read_count: number;
  execution_cost_read_length: number;
  execution_cost_runtime: number;
  execution_cost_write_count: number;
  execution_cost_write_length: number;
}

export interface StacksTransaction {
  tx_id: string;
  nonce: number;
  fee_rate: string;
  sender_address: string;
  sponsored: boolean;
  post_condition_mode: string;
  post_conditions: unknown[];
  anchor_mode: string;
  tx_status: string;
  receipt_time: number;
  receipt_time_iso: string;
  tx_type: string;
  token_transfer?: {
    recipient_address: string;
    amount: string;
    memo: string;
  };
  smart_contract?: {
    clarity_version: number;
    contract_id: string;
    source_code: string;
  };
  contract_call?: {
    contract_id: string;
    function_name: string;
    function_signature: string;
    function_args?: {
      hex: string;
      repr: string;
      name: string;
      type: string;
    }[];
  };
  coinbase_payload?: {
    data: string;
    alt_recipient?: string;
    vrf_proof?: string;
  };
  tenure_change_payload?: {
    tenure_consensus_hash: string;
    prev_tenure_consensus_hash: string;
    burn_view_consensus_hash: string;
    previous_tenure_end: string;
    previous_tenure_blocks: number;
    cause: string;
    pubkey_hash: string;
  };
  events?: StacksEvent[];
  block_hash?: string;
  block_height?: number;
  block_time?: number;
  block_time_iso?: string;
  burn_block_height?: number;
  burn_block_time?: number;
  burn_block_time_iso?: string;
  parent_burn_block_time?: number;
  parent_burn_block_time_iso?: string;
  canonical?: boolean;
  tx_index?: number;
  tx_result?: {
    hex: string;
    repr: string;
  };
  event_count?: number;
  parent_block_hash?: string;
  is_unanchored?: boolean;
  microblock_hash?: string;
  microblock_sequence?: number;
  microblock_canonical?: boolean;
  execution_cost_read_count?: number;
  execution_cost_read_length?: number;
  execution_cost_runtime?: number;
  execution_cost_write_count?: number;
  execution_cost_write_length?: number;
}

export interface StacksEvent {
  event_index: number;
  event_type: string;
  tx_id: string;
  contract_log?: {
    contract_id: string;
    topic: string;
    value: {
      hex: string;
      repr: string;
    };
  };
  stx_transfer_event?: {
    sender: string;
    recipient: string;
    amount: string;
    memo?: string;
  };
  stx_mint_event?: {
    recipient: string;
    amount: string;
  };
  stx_burn_event?: {
    sender: string;
    amount: string;
  };
  stx_lock_event?: {
    locked_amount: string;
    unlock_height: number;
    locked_address: string;
  };
  ft_transfer_event?: {
    asset_identifier: string;
    sender: string;
    recipient: string;
    amount: string;
  };
  ft_mint_event?: {
    asset_identifier: string;
    recipient: string;
    amount: string;
  };
  ft_burn_event?: {
    asset_identifier: string;
    sender: string;
    amount: string;
  };
  nft_transfer_event?: {
    asset_identifier: string;
    sender: string;
    recipient: string;
    value: {
      hex: string;
      repr: string;
    };
  };
  nft_mint_event?: {
    asset_identifier: string;
    recipient: string;
    value: {
      hex: string;
      repr: string;
    };
  };
  nft_burn_event?: {
    asset_identifier: string;
    sender: string;
    value: {
      hex: string;
      repr: string;
    };
  };
}

export interface StacksNeighbors {
  bootstrap: StacksPeer[];
  sample: StacksPeer[];
  inbound: StacksPeer[];
  outbound: StacksPeer[];
}

export interface StacksPeer {
  network_id: number;
  peer_version: number;
  ip: string;
  port: number;
  public_key_hash: string;
  authenticated: boolean;
  stackerdbs: string[];
  age: number;
}

export interface StacksFeeEstimate {
  estimated_cost: {
    read_count: number;
    read_length: number;
    runtime: number;
    write_count: number;
    write_length: number;
  };
  estimated_cost_scalar: number;
  estimations: {
    fee: number;
    fee_rate: number;
  }[];
  cost_scalar_change_by_byte: number;
}

export interface StacksTransferFee {
  fee: number;
}

export interface StacksHealthStatus {
  status: string;
  error?: string;
  data?: {
    peer_count: number;
    stacks_tip_height: number;
    target_burn_block_height: number;
    tip_burn_block_height: number;
    burn_block_height_delta: number;
  };
}

export interface StacksTenureInfo {
  consensus_hash: string;
  tenure_start_block_id: string;
  parent_consensus_hash: string;
  parent_tenure_start_block_id: string;
  tip_block_id: string;
  tip_height: number;
  reward_cycle: number;
}

export interface StacksMempoolQuery {
  txids: string[];
  page_size?: number;
  page?: number;
}

export interface StacksMempoolQueryResponse {
  txids: string[];
}

export interface StacksBroadcastResponse {
  txid: string;
  error?: string;
  reason?: string;
  reason_data?: Record<string, unknown>;
}

export interface StacksConfirmedTransaction {
  index_block_hash: string;
  tx: string;
  result: string;
  block_height?: number | null;
  is_canonical?: boolean;
}

export interface StacksBlockReplayTransaction {
  data: unknown;
  events: unknown[];
  execution_cost: unknown;
  hex: string;
  result: unknown;
  result_hex: string;
  post_condition_aborted: boolean;
  stx_burned: number;
  tx_index: number;
  txid: string;
  vm_error: string | null;
}

export interface StacksBlockReplay {
  block_hash: string;
  block_id: string;
  block_height: number;
  consensus_hash: string;
  fees: number;
  miner_signature: string;
  parent_block_id: string;
  signer_signature: string[];
  state_index_root: string;
  timestamp: number;
  tx_merkle_root: string;
  valid_merkle_root: boolean;
  transactions: StacksBlockReplayTransaction[];
}

export interface StacksContractCallReadOnlySuccess {
  okay: true;
  result: string;
}

export interface StacksContractCallReadOnlyError {
  okay: false;
  cause: string;
}

export type StacksContractCallReadOnlyResult =
  | StacksContractCallReadOnlySuccess
  | StacksContractCallReadOnlyError;

export type StacksContractInterface = Record<string, unknown>;

export interface StacksContractSource {
  source: string;
  publish_height: number;
  proof?: string;
}

export interface StacksContractConstantVal {
  data: string;
}

export interface StacksContractDataVar {
  data: string;
  proof?: string;
}
