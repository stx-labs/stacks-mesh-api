// Re-export core Mesh types from the serializer package
export type {
  Block,
  BlockIdentifier,
  Transaction,
  TransactionIdentifier,
  Operation,
  OperationIdentifier,
  Amount,
  Currency,
  AccountIdentifier,
  SubAccountIdentifier,
  CoinChange,
  CoinIdentifier,
  CoinAction,
  RelatedTransaction,
  Direction,
  NetworkIdentifier,
  SubNetworkIdentifier,
} from '@stacks/mesh-serializer';

// Additional Mesh API types not needed by the serializer

export interface PartialBlockIdentifier {
  index?: number;
  hash?: string;
}

export interface Coin {
  coin_identifier: CoinIdentifier;
  amount: Amount;
}

import type { CoinIdentifier, Amount } from '@stacks/mesh-serializer';

export interface Peer {
  peer_id: string;
  metadata?: Record<string, unknown>;
}

export interface SyncStatus {
  current_index?: number;
  target_index?: number;
  stage?: string;
  synced?: boolean;
}

export interface Version {
  rosetta_version: string;
  node_version: string;
  middleware_version?: string;
  metadata?: Record<string, unknown>;
}

export interface Allow {
  operation_statuses: OperationStatus[];
  operation_types: string[];
  errors: MeshError[];
  historical_balance_lookup: boolean;
  timestamp_start_index?: number;
  call_methods: string[];
  balance_exemptions: BalanceExemption[];
  mempool_coins: boolean;
  block_hash_case?: Case;
  transaction_hash_case?: Case;
}

export interface OperationStatus {
  status: string;
  successful: boolean;
}

export interface BalanceExemption {
  sub_account_address?: string;
  currency?: import('@stacks/mesh-serializer').Currency;
  exemption_type?: ExemptionType;
}

export type ExemptionType = 'greater_or_equal' | 'less_or_equal' | 'dynamic';

export type Case = 'upper_case' | 'lower_case' | 'case_sensitive' | 'null';

// === Error ===

export interface MeshError {
  code: number;
  message: string;
  description?: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

// === Signing ===

export interface PublicKey {
  hex_bytes: string;
  curve_type: CurveType;
}

export type CurveType = 'secp256k1' | 'secp256r1' | 'edwards25519' | 'tweedle' | 'pallas';

export interface SigningPayload {
  address?: string;
  account_identifier?: import('@stacks/mesh-serializer').AccountIdentifier;
  hex_bytes: string;
  signature_type?: SignatureType;
}

export type SignatureType =
  | 'ecdsa'
  | 'ecdsa_recovery'
  | 'ed25519'
  | 'schnorr_1'
  | 'schnorr_bip340'
  | 'schnorr_poseidon';

export interface Signature {
  signing_payload: SigningPayload;
  public_key: PublicKey;
  signature_type: SignatureType;
  hex_bytes: string;
}

// === Network API Requests/Responses ===

export interface MetadataRequest {
  metadata?: Record<string, unknown>;
}

export interface NetworkRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  metadata?: Record<string, unknown>;
}

export interface NetworkListResponse {
  network_identifiers: import('@stacks/mesh-serializer').NetworkIdentifier[];
}

export interface NetworkStatusResponse {
  current_block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  current_block_timestamp: number;
  genesis_block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  oldest_block_identifier?: import('@stacks/mesh-serializer').BlockIdentifier;
  sync_status?: SyncStatus;
  peers: Peer[];
}

export interface NetworkOptionsResponse {
  version: Version;
  allow: Allow;
}

// === Block API Requests/Responses ===

export interface BlockRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  block_identifier: PartialBlockIdentifier;
}

export interface BlockResponse {
  block?: import('@stacks/mesh-serializer').Block;
  other_transactions?: import('@stacks/mesh-serializer').TransactionIdentifier[];
}

export interface BlockTransactionRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  transaction_identifier: import('@stacks/mesh-serializer').TransactionIdentifier;
}

export interface BlockTransactionResponse {
  transaction: import('@stacks/mesh-serializer').Transaction;
}

// === Mempool API Requests/Responses ===

export interface MempoolResponse {
  transaction_identifiers: import('@stacks/mesh-serializer').TransactionIdentifier[];
}

export interface MempoolTransactionRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  transaction_identifier: import('@stacks/mesh-serializer').TransactionIdentifier;
}

export interface MempoolTransactionResponse {
  transaction: import('@stacks/mesh-serializer').Transaction;
  metadata?: Record<string, unknown>;
}

// === Account API Requests/Responses ===

export interface AccountBalanceRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  account_identifier: import('@stacks/mesh-serializer').AccountIdentifier;
  block_identifier?: PartialBlockIdentifier;
  currencies?: import('@stacks/mesh-serializer').Currency[];
}

export interface AccountBalanceResponse {
  block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  balances: import('@stacks/mesh-serializer').Amount[];
  metadata?: Record<string, unknown>;
}

export interface AccountCoinsRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  account_identifier: import('@stacks/mesh-serializer').AccountIdentifier;
  include_mempool: boolean;
  currencies?: import('@stacks/mesh-serializer').Currency[];
}

export interface AccountCoinsResponse {
  block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  coins: Coin[];
  metadata?: Record<string, unknown>;
}

// === Construction API Requests/Responses ===

export interface ConstructionDeriveRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  public_key: PublicKey;
  metadata?: Record<string, unknown>;
}

export interface ConstructionDeriveResponse {
  account_identifier?: import('@stacks/mesh-serializer').AccountIdentifier;
  address?: string;
  metadata?: Record<string, unknown>;
}

export interface ConstructionPreprocessRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  operations: import('@stacks/mesh-serializer').Operation[];
  metadata?: Record<string, unknown>;
  max_fee?: import('@stacks/mesh-serializer').Amount[];
  suggested_fee_multiplier?: number;
}

export interface ConstructionPreprocessResponse {
  options?: Record<string, unknown>;
  required_public_keys?: import('@stacks/mesh-serializer').AccountIdentifier[];
}

export interface ConstructionMetadataRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  options?: Record<string, unknown>;
  public_keys?: PublicKey[];
}

export interface ConstructionMetadataResponse {
  metadata: Record<string, unknown>;
  suggested_fee?: import('@stacks/mesh-serializer').Amount[];
}

export interface ConstructionPayloadsRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  operations: import('@stacks/mesh-serializer').Operation[];
  metadata?: Record<string, unknown>;
  public_keys?: PublicKey[];
}

export interface ConstructionPayloadsResponse {
  unsigned_transaction: string;
  payloads: SigningPayload[];
}

export interface ConstructionCombineRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  unsigned_transaction: string;
  signatures: Signature[];
}

export interface ConstructionCombineResponse {
  signed_transaction: string;
}

export interface ConstructionParseRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  signed: boolean;
  transaction: string;
}

export interface ConstructionParseResponse {
  operations: import('@stacks/mesh-serializer').Operation[];
  signers?: string[];
  account_identifier_signers?: import('@stacks/mesh-serializer').AccountIdentifier[];
  metadata?: Record<string, unknown>;
}

export interface ConstructionHashRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  signed_transaction: string;
}

export interface TransactionIdentifierResponse {
  transaction_identifier: import('@stacks/mesh-serializer').TransactionIdentifier;
  metadata?: Record<string, unknown>;
}

export interface ConstructionSubmitRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  signed_transaction: string;
}

// === Call API Requests/Responses ===

export interface CallRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  method: string;
  parameters: Record<string, unknown>;
}

export interface CallResponse {
  result: Record<string, unknown>;
  idempotent: boolean;
}

// === Search API Requests/Responses ===

export interface SearchTransactionsRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  operator?: Operator;
  max_block?: number;
  offset?: number;
  limit?: number;
  transaction_identifier?: import('@stacks/mesh-serializer').TransactionIdentifier;
  account_identifier?: import('@stacks/mesh-serializer').AccountIdentifier;
  coin_identifier?: CoinIdentifier;
  currency?: import('@stacks/mesh-serializer').Currency;
  status?: string;
  type?: string;
  address?: string;
  success?: boolean;
}

export type Operator = 'or' | 'and';

export interface SearchTransactionsResponse {
  transactions: BlockTransaction[];
  total_count: number;
  next_offset?: number;
}

export interface BlockTransaction {
  block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  transaction: import('@stacks/mesh-serializer').Transaction;
}

// === Events API Requests/Responses ===

export interface EventsBlocksRequest {
  network_identifier: import('@stacks/mesh-serializer').NetworkIdentifier;
  offset?: number;
  limit?: number;
}

export interface EventsBlocksResponse {
  max_sequence: number;
  events: BlockEvent[];
}

export interface BlockEvent {
  sequence: number;
  block_identifier: import('@stacks/mesh-serializer').BlockIdentifier;
  type: BlockEventType;
}

export type BlockEventType = 'block_added' | 'block_removed';
