import { BlockIdentifierSchema } from "../entities/common.js";
import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";
import { ErrorResponseSchema } from "./error.js";
import { CurrencySchema } from "../entities/operations.js";

export const SyncStatusSchema = Type.Object({
  current_index: Type.Optional(Type.Number()),
  target_index: Type.Optional(Type.Number()),
  stage: Type.Optional(Type.String()),
  synced: Type.Optional(Type.Boolean()),
});
export type SyncStatus = Static<typeof SyncStatusSchema>;

export const VersionSchema = Type.Object({
  rosetta_version: Type.String(),
  node_version: Type.String(),
  middleware_version: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type Version = Static<typeof VersionSchema>;

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
export type BalanceExemption = Static<typeof BalanceExemptionSchema>;

export const OperationStatusSchema = Type.Object({
  status: Type.String(),
  successful: Type.Boolean(),
});
export type OperationStatus = Static<typeof OperationStatusSchema>;

export const AllowSchema = Type.Object({
  operation_statuses: Type.Array(OperationStatusSchema),
  operation_types: Type.Array(Type.String()),
  errors: Type.Array(ErrorResponseSchema),
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
export type Allow = Static<typeof AllowSchema>;

export const PeerSchema = Type.Object({
  peer_id: Type.String(),
  metadata: Type.Object({
    ip: Type.String(),
    port: Type.Number(),
  }),
});
export type Peer = Static<typeof PeerSchema>;

export const NetworkListResponseSchema = Type.Object({
  network_identifiers: Type.Array(NetworkIdentifierSchema),
});
export type NetworkListResponse = Static<typeof NetworkListResponseSchema>;

export const NetworkStatusResponseSchema = Type.Object({
  current_block_identifier: BlockIdentifierSchema,
  current_block_timestamp: Type.Number(),
  genesis_block_identifier: BlockIdentifierSchema,
  oldest_block_identifier: Type.Optional(BlockIdentifierSchema),
  sync_status: Type.Optional(SyncStatusSchema),
  peers: Type.Array(PeerSchema),
});
export type NetworkStatusResponse = Static<typeof NetworkStatusResponseSchema>;

export const NetworkOptionsResponseSchema = Type.Object({
  version: VersionSchema,
  allow: AllowSchema,
});
export type NetworkOptionsResponse = Static<typeof NetworkOptionsResponseSchema>;
