// Mesh API Types based on Coinbase Mesh Specification

// === Identifiers ===

export interface NetworkIdentifier {
  blockchain: string;
  network: string;
  sub_network_identifier?: SubNetworkIdentifier;
}

export interface SubNetworkIdentifier {
  network: string;
  metadata?: Record<string, unknown>;
}

export interface BlockIdentifier {
  index: number;
  hash: string;
}

export interface PartialBlockIdentifier {
  index?: number;
  hash?: string;
}

export interface TransactionIdentifier {
  hash: string;
}

export interface AccountIdentifier {
  address: string;
  sub_account?: SubAccountIdentifier;
  metadata?: Record<string, unknown>;
}

export interface SubAccountIdentifier {
  address: string;
  metadata?: Record<string, unknown>;
}

export interface OperationIdentifier {
  index: number;
  network_index?: number;
}

export interface CoinIdentifier {
  identifier: string;
}

// === Common Objects ===

export interface Amount {
  value: string;
  currency: Currency;
  metadata?: Record<string, unknown>;
}

export interface Currency {
  symbol: string;
  decimals: number;
  metadata?: Record<string, unknown>;
}

export interface Operation {
  operation_identifier: OperationIdentifier;
  related_operations?: OperationIdentifier[];
  type: string;
  status?: string;
  account?: AccountIdentifier;
  amount?: Amount;
  coin_change?: CoinChange;
  metadata?: Record<string, unknown>;
}

export interface CoinChange {
  coin_identifier: CoinIdentifier;
  coin_action: CoinAction;
}

export type CoinAction = 'coin_created' | 'coin_spent';

export interface Transaction {
  transaction_identifier: TransactionIdentifier;
  operations: Operation[];
  related_transactions?: RelatedTransaction[];
  metadata?: Record<string, unknown>;
}

export interface RelatedTransaction {
  network_identifier?: NetworkIdentifier;
  transaction_identifier: TransactionIdentifier;
  direction: Direction;
}

export type Direction = 'forward' | 'backward';

export interface Block {
  block_identifier: BlockIdentifier;
  parent_block_identifier: BlockIdentifier;
  timestamp: number;
  transactions: Transaction[];
  metadata?: Record<string, unknown>;
}

export interface Coin {
  coin_identifier: CoinIdentifier;
  amount: Amount;
}

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
  currency?: Currency;
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
  account_identifier?: AccountIdentifier;
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
  network_identifier: NetworkIdentifier;
  metadata?: Record<string, unknown>;
}

export interface NetworkListResponse {
  network_identifiers: NetworkIdentifier[];
}

export interface NetworkStatusResponse {
  current_block_identifier: BlockIdentifier;
  current_block_timestamp: number;
  genesis_block_identifier: BlockIdentifier;
  oldest_block_identifier?: BlockIdentifier;
  sync_status?: SyncStatus;
  peers: Peer[];
}

export interface NetworkOptionsResponse {
  version: Version;
  allow: Allow;
}

// === Block API Requests/Responses ===

export interface BlockRequest {
  network_identifier: NetworkIdentifier;
  block_identifier: PartialBlockIdentifier;
}

export interface BlockResponse {
  block?: Block;
  other_transactions?: TransactionIdentifier[];
}

export interface BlockTransactionRequest {
  network_identifier: NetworkIdentifier;
  block_identifier: BlockIdentifier;
  transaction_identifier: TransactionIdentifier;
}

export interface BlockTransactionResponse {
  transaction: Transaction;
}

// === Mempool API Requests/Responses ===

export interface MempoolResponse {
  transaction_identifiers: TransactionIdentifier[];
}

export interface MempoolTransactionRequest {
  network_identifier: NetworkIdentifier;
  transaction_identifier: TransactionIdentifier;
}

export interface MempoolTransactionResponse {
  transaction: Transaction;
  metadata?: Record<string, unknown>;
}

// === Account API Requests/Responses ===

export interface AccountBalanceRequest {
  network_identifier: NetworkIdentifier;
  account_identifier: AccountIdentifier;
  block_identifier?: PartialBlockIdentifier;
  currencies?: Currency[];
}

export interface AccountBalanceResponse {
  block_identifier: BlockIdentifier;
  balances: Amount[];
  metadata?: Record<string, unknown>;
}

export interface AccountCoinsRequest {
  network_identifier: NetworkIdentifier;
  account_identifier: AccountIdentifier;
  include_mempool: boolean;
  currencies?: Currency[];
}

export interface AccountCoinsResponse {
  block_identifier: BlockIdentifier;
  coins: Coin[];
  metadata?: Record<string, unknown>;
}

// === Construction API Requests/Responses ===

export interface ConstructionDeriveRequest {
  network_identifier: NetworkIdentifier;
  public_key: PublicKey;
  metadata?: Record<string, unknown>;
}

export interface ConstructionDeriveResponse {
  account_identifier?: AccountIdentifier;
  address?: string;
  metadata?: Record<string, unknown>;
}

export interface ConstructionPreprocessRequest {
  network_identifier: NetworkIdentifier;
  operations: Operation[];
  metadata?: Record<string, unknown>;
  max_fee?: Amount[];
  suggested_fee_multiplier?: number;
}

export interface ConstructionPreprocessResponse {
  options?: Record<string, unknown>;
  required_public_keys?: AccountIdentifier[];
}

export interface ConstructionMetadataRequest {
  network_identifier: NetworkIdentifier;
  options?: Record<string, unknown>;
  public_keys?: PublicKey[];
}

export interface ConstructionMetadataResponse {
  metadata: Record<string, unknown>;
  suggested_fee?: Amount[];
}

export interface ConstructionPayloadsRequest {
  network_identifier: NetworkIdentifier;
  operations: Operation[];
  metadata?: Record<string, unknown>;
  public_keys?: PublicKey[];
}

export interface ConstructionPayloadsResponse {
  unsigned_transaction: string;
  payloads: SigningPayload[];
}

export interface ConstructionCombineRequest {
  network_identifier: NetworkIdentifier;
  unsigned_transaction: string;
  signatures: Signature[];
}

export interface ConstructionCombineResponse {
  signed_transaction: string;
}

export interface ConstructionParseRequest {
  network_identifier: NetworkIdentifier;
  signed: boolean;
  transaction: string;
}

export interface ConstructionParseResponse {
  operations: Operation[];
  signers?: string[];
  account_identifier_signers?: AccountIdentifier[];
  metadata?: Record<string, unknown>;
}

export interface ConstructionHashRequest {
  network_identifier: NetworkIdentifier;
  signed_transaction: string;
}

export interface TransactionIdentifierResponse {
  transaction_identifier: TransactionIdentifier;
  metadata?: Record<string, unknown>;
}

export interface ConstructionSubmitRequest {
  network_identifier: NetworkIdentifier;
  signed_transaction: string;
}

// === Call API Requests/Responses ===

export interface CallRequest {
  network_identifier: NetworkIdentifier;
  method: string;
  parameters: Record<string, unknown>;
}

export interface CallResponse {
  result: Record<string, unknown>;
  idempotent: boolean;
}

// === Search API Requests/Responses ===

export interface SearchTransactionsRequest {
  network_identifier: NetworkIdentifier;
  operator?: Operator;
  max_block?: number;
  offset?: number;
  limit?: number;
  transaction_identifier?: TransactionIdentifier;
  account_identifier?: AccountIdentifier;
  coin_identifier?: CoinIdentifier;
  currency?: Currency;
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
  block_identifier: BlockIdentifier;
  transaction: Transaction;
}

// === Events API Requests/Responses ===

export interface EventsBlocksRequest {
  network_identifier: NetworkIdentifier;
  offset?: number;
  limit?: number;
}

export interface EventsBlocksResponse {
  max_sequence: number;
  events: BlockEvent[];
}

export interface BlockEvent {
  sequence: number;
  block_identifier: BlockIdentifier;
  type: BlockEventType;
}

export type BlockEventType = 'block_added' | 'block_removed';
