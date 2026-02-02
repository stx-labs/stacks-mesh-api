import { Type, type Static } from '@sinclair/typebox';

// === Base Identifiers ===

export const NetworkIdentifierSchema = Type.Object({
  blockchain: Type.String(),
  network: Type.String(),
  sub_network_identifier: Type.Optional(
    Type.Object({
      network: Type.String(),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    })
  ),
});

export const BlockIdentifierSchema = Type.Object({
  index: Type.Number(),
  hash: Type.String(),
});

export const PartialBlockIdentifierSchema = Type.Object({
  index: Type.Optional(Type.Number()),
  hash: Type.Optional(Type.String()),
});

export const TransactionIdentifierSchema = Type.Object({
  hash: Type.String(),
});

export const AccountIdentifierSchema = Type.Object({
  address: Type.String(),
  sub_account: Type.Optional(
    Type.Object({
      address: Type.String(),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    })
  ),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const CurrencySchema = Type.Object({
  symbol: Type.String(),
  decimals: Type.Number(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const AmountSchema = Type.Object({
  value: Type.String(),
  currency: CurrencySchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const OperationIdentifierSchema = Type.Object({
  index: Type.Number(),
  network_index: Type.Optional(Type.Number()),
});

export const CoinIdentifierSchema = Type.Object({
  identifier: Type.String(),
});

export const PublicKeySchema = Type.Object({
  hex_bytes: Type.String(),
  curve_type: Type.Union([
    Type.Literal('secp256k1'),
    Type.Literal('secp256r1'),
    Type.Literal('edwards25519'),
    Type.Literal('tweedle'),
    Type.Literal('pallas'),
  ]),
});

export const SigningPayloadSchema = Type.Object({
  address: Type.Optional(Type.String()),
  account_identifier: Type.Optional(AccountIdentifierSchema),
  hex_bytes: Type.String(),
  signature_type: Type.Optional(
    Type.Union([
      Type.Literal('ecdsa'),
      Type.Literal('ecdsa_recovery'),
      Type.Literal('ed25519'),
      Type.Literal('schnorr_1'),
      Type.Literal('schnorr_bip340'),
      Type.Literal('schnorr_poseidon'),
    ])
  ),
});

export const SignatureSchema = Type.Object({
  signing_payload: SigningPayloadSchema,
  public_key: PublicKeySchema,
  signature_type: Type.Union([
    Type.Literal('ecdsa'),
    Type.Literal('ecdsa_recovery'),
    Type.Literal('ed25519'),
    Type.Literal('schnorr_1'),
    Type.Literal('schnorr_bip340'),
    Type.Literal('schnorr_poseidon'),
  ]),
  hex_bytes: Type.String(),
});

export const OperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  related_operations: Type.Optional(Type.Array(OperationIdentifierSchema)),
  type: Type.String(),
  status: Type.Optional(Type.String()),
  account: Type.Optional(AccountIdentifierSchema),
  amount: Type.Optional(AmountSchema),
  coin_change: Type.Optional(
    Type.Object({
      coin_identifier: CoinIdentifierSchema,
      coin_action: Type.Union([Type.Literal('coin_created'), Type.Literal('coin_spent')]),
    })
  ),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Network API Schemas ===

export const MetadataRequestSchema = Type.Object({
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const NetworkRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Block API Schemas ===

export const BlockRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  block_identifier: PartialBlockIdentifierSchema,
});

export const BlockTransactionRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  block_identifier: BlockIdentifierSchema,
  transaction_identifier: TransactionIdentifierSchema,
});

// === Mempool API Schemas ===

export const MempoolTransactionRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  transaction_identifier: TransactionIdentifierSchema,
});

// === Account API Schemas ===

export const AccountBalanceRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  account_identifier: AccountIdentifierSchema,
  block_identifier: Type.Optional(PartialBlockIdentifierSchema),
  currencies: Type.Optional(Type.Array(CurrencySchema)),
});

export const AccountCoinsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  account_identifier: AccountIdentifierSchema,
  include_mempool: Type.Boolean(),
  currencies: Type.Optional(Type.Array(CurrencySchema)),
});

// === Construction API Schemas ===

export const ConstructionDeriveRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  public_key: PublicKeySchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const ConstructionPreprocessRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(OperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  max_fee: Type.Optional(Type.Array(AmountSchema)),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});

export const ConstructionMetadataRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  public_keys: Type.Optional(Type.Array(PublicKeySchema)),
});

export const ConstructionPayloadsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(OperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  public_keys: Type.Optional(Type.Array(PublicKeySchema)),
});

export const ConstructionCombineRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  unsigned_transaction: Type.String(),
  signatures: Type.Array(SignatureSchema),
});

export const ConstructionParseRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed: Type.Boolean(),
  transaction: Type.String(),
});

export const ConstructionHashRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});

export const ConstructionSubmitRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});

// === Call API Schema ===

export const CallRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  method: Type.String(),
  parameters: Type.Record(Type.String(), Type.Unknown()),
});

// === Error Response Schema ===

export const MeshErrorSchema = Type.Object({
  code: Type.Number(),
  message: Type.String(),
  description: Type.Optional(Type.String()),
  retriable: Type.Boolean(),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Common Response Components ===

export const OperationStatusSchema = Type.Object({
  status: Type.String(),
  successful: Type.Boolean(),
});

export const BalanceExemptionSchema = Type.Object({
  sub_account_address: Type.Optional(Type.String()),
  currency: Type.Optional(CurrencySchema),
  exemption_type: Type.Optional(
    Type.Union([
      Type.Literal('greater_or_equal'),
      Type.Literal('less_or_equal'),
      Type.Literal('dynamic'),
    ])
  ),
});

export const VersionSchema = Type.Object({
  rosetta_version: Type.String(),
  node_version: Type.String(),
  middleware_version: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const AllowSchema = Type.Object({
  operation_statuses: Type.Array(OperationStatusSchema),
  operation_types: Type.Array(Type.String()),
  errors: Type.Array(MeshErrorSchema),
  historical_balance_lookup: Type.Boolean(),
  timestamp_start_index: Type.Optional(Type.Number()),
  call_methods: Type.Array(Type.String()),
  balance_exemptions: Type.Array(BalanceExemptionSchema),
  mempool_coins: Type.Boolean(),
  block_hash_case: Type.Optional(
    Type.Union([
      Type.Literal('upper_case'),
      Type.Literal('lower_case'),
      Type.Literal('case_sensitive'),
      Type.Literal('null'),
    ])
  ),
  transaction_hash_case: Type.Optional(
    Type.Union([
      Type.Literal('upper_case'),
      Type.Literal('lower_case'),
      Type.Literal('case_sensitive'),
      Type.Literal('null'),
    ])
  ),
});

export const PeerSchema = Type.Object({
  peer_id: Type.String(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const SyncStatusSchema = Type.Object({
  current_index: Type.Optional(Type.Number()),
  target_index: Type.Optional(Type.Number()),
  stage: Type.Optional(Type.String()),
  synced: Type.Optional(Type.Boolean()),
});

export const RelatedTransactionSchema = Type.Object({
  network_identifier: Type.Optional(NetworkIdentifierSchema),
  transaction_identifier: TransactionIdentifierSchema,
  direction: Type.Union([Type.Literal('forward'), Type.Literal('backward')]),
});

export const TransactionSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  operations: Type.Array(OperationSchema),
  related_transactions: Type.Optional(Type.Array(RelatedTransactionSchema)),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const BlockSchema = Type.Object({
  block_identifier: BlockIdentifierSchema,
  parent_block_identifier: BlockIdentifierSchema,
  timestamp: Type.Number(),
  transactions: Type.Array(TransactionSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const CoinSchema = Type.Object({
  coin_identifier: CoinIdentifierSchema,
  amount: AmountSchema,
});

// === Network API Response Schemas ===

export const NetworkListResponseSchema = Type.Object({
  network_identifiers: Type.Array(NetworkIdentifierSchema),
});

export const NetworkStatusResponseSchema = Type.Object({
  current_block_identifier: BlockIdentifierSchema,
  current_block_timestamp: Type.Number(),
  genesis_block_identifier: BlockIdentifierSchema,
  oldest_block_identifier: Type.Optional(BlockIdentifierSchema),
  sync_status: Type.Optional(SyncStatusSchema),
  peers: Type.Array(PeerSchema),
});

export const NetworkOptionsResponseSchema = Type.Object({
  version: VersionSchema,
  allow: AllowSchema,
});

// === Block API Response Schemas ===

export const BlockResponseSchema = Type.Object({
  block: Type.Optional(BlockSchema),
  other_transactions: Type.Optional(Type.Array(TransactionIdentifierSchema)),
});

export const BlockTransactionResponseSchema = Type.Object({
  transaction: TransactionSchema,
});

// === Mempool API Response Schemas ===

export const MempoolResponseSchema = Type.Object({
  transaction_identifiers: Type.Array(TransactionIdentifierSchema),
});

export const MempoolTransactionResponseSchema = Type.Object({
  transaction: TransactionSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Account API Response Schemas ===

export const AccountBalanceResponseSchema = Type.Object({
  block_identifier: BlockIdentifierSchema,
  balances: Type.Array(AmountSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const AccountCoinsResponseSchema = Type.Object({
  block_identifier: BlockIdentifierSchema,
  coins: Type.Array(CoinSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Construction API Response Schemas ===

export const ConstructionDeriveResponseSchema = Type.Object({
  address: Type.Optional(Type.String()),
  account_identifier: Type.Optional(AccountIdentifierSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const ConstructionPreprocessResponseSchema = Type.Object({
  options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  required_public_keys: Type.Optional(Type.Array(AccountIdentifierSchema)),
});

export const ConstructionMetadataResponseSchema = Type.Object({
  metadata: Type.Record(Type.String(), Type.Unknown()),
  suggested_fee: Type.Optional(Type.Array(AmountSchema)),
});

export const ConstructionPayloadsResponseSchema = Type.Object({
  unsigned_transaction: Type.String(),
  payloads: Type.Array(SigningPayloadSchema),
});

export const ConstructionCombineResponseSchema = Type.Object({
  signed_transaction: Type.String(),
});

export const ConstructionParseResponseSchema = Type.Object({
  operations: Type.Array(OperationSchema),
  signers: Type.Optional(Type.Array(Type.String())),
  account_identifier_signers: Type.Optional(Type.Array(AccountIdentifierSchema)),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const TransactionIdentifierResponseSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// === Call API Response Schema ===

export const CallResponseSchema = Type.Object({
  result: Type.Record(Type.String(), Type.Unknown()),
  idempotent: Type.Boolean(),
});

// === Static Types ===

export type NetworkIdentifier = Static<typeof NetworkIdentifierSchema>;
export type BlockIdentifier = Static<typeof BlockIdentifierSchema>;
export type PartialBlockIdentifier = Static<typeof PartialBlockIdentifierSchema>;
export type TransactionIdentifier = Static<typeof TransactionIdentifierSchema>;
export type AccountIdentifier = Static<typeof AccountIdentifierSchema>;
export type Currency = Static<typeof CurrencySchema>;
export type Amount = Static<typeof AmountSchema>;
export type Operation = Static<typeof OperationSchema>;
export type PublicKey = Static<typeof PublicKeySchema>;
export type Signature = Static<typeof SignatureSchema>;

export type MetadataRequest = Static<typeof MetadataRequestSchema>;
export type NetworkRequest = Static<typeof NetworkRequestSchema>;
export type BlockRequest = Static<typeof BlockRequestSchema>;
export type BlockTransactionRequest = Static<typeof BlockTransactionRequestSchema>;
export type MempoolTransactionRequest = Static<typeof MempoolTransactionRequestSchema>;
export type AccountBalanceRequest = Static<typeof AccountBalanceRequestSchema>;
export type AccountCoinsRequest = Static<typeof AccountCoinsRequestSchema>;
export type ConstructionDeriveRequest = Static<typeof ConstructionDeriveRequestSchema>;
export type ConstructionPreprocessRequest = Static<typeof ConstructionPreprocessRequestSchema>;
export type ConstructionMetadataRequest = Static<typeof ConstructionMetadataRequestSchema>;
export type ConstructionPayloadsRequest = Static<typeof ConstructionPayloadsRequestSchema>;
export type ConstructionCombineRequest = Static<typeof ConstructionCombineRequestSchema>;
export type ConstructionParseRequest = Static<typeof ConstructionParseRequestSchema>;
export type ConstructionHashRequest = Static<typeof ConstructionHashRequestSchema>;
export type ConstructionSubmitRequest = Static<typeof ConstructionSubmitRequestSchema>;
export type CallRequest = Static<typeof CallRequestSchema>;

// Response types
export type MeshError = Static<typeof MeshErrorSchema>;
export type NetworkListResponse = Static<typeof NetworkListResponseSchema>;
export type NetworkStatusResponse = Static<typeof NetworkStatusResponseSchema>;
export type NetworkOptionsResponse = Static<typeof NetworkOptionsResponseSchema>;
export type BlockResponse = Static<typeof BlockResponseSchema>;
export type BlockTransactionResponse = Static<typeof BlockTransactionResponseSchema>;
export type MempoolResponse = Static<typeof MempoolResponseSchema>;
export type MempoolTransactionResponse = Static<typeof MempoolTransactionResponseSchema>;
export type AccountBalanceResponse = Static<typeof AccountBalanceResponseSchema>;
export type AccountCoinsResponse = Static<typeof AccountCoinsResponseSchema>;
export type ConstructionDeriveResponse = Static<typeof ConstructionDeriveResponseSchema>;
export type ConstructionPreprocessResponse = Static<typeof ConstructionPreprocessResponseSchema>;
export type ConstructionMetadataResponse = Static<typeof ConstructionMetadataResponseSchema>;
export type ConstructionPayloadsResponse = Static<typeof ConstructionPayloadsResponseSchema>;
export type ConstructionCombineResponse = Static<typeof ConstructionCombineResponseSchema>;
export type ConstructionParseResponse = Static<typeof ConstructionParseResponseSchema>;
export type TransactionIdentifierResponse = Static<typeof TransactionIdentifierResponseSchema>;
export type CallResponse = Static<typeof CallResponseSchema>;
export type Transaction = Static<typeof TransactionSchema>;
export type Block = Static<typeof BlockSchema>;
