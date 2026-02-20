import { Static, Type } from '@sinclair/typebox';
import { BlockIdentifierSchema, Nullable, ExecutionCostSchema } from './common.js';
import { TransactionSchema } from './transaction.js';

export const BlockMetadataSchema = Type.Object({
  canonical: Type.Boolean(),
  burn_block_identifier: BlockIdentifierSchema,
  burn_block_timestamp: Type.Integer(),
  parent_microblock_identifier: Nullable(BlockIdentifierSchema),
  tenure_height: Type.Integer(),
  execution_cost: ExecutionCostSchema,
  tx_total_size: Type.Integer(),
  tx_count: Type.Integer(),
  signatures: Type.Optional(
    Type.Object({
      signer_bitvec: Nullable(Type.String()),
      signer_signatures: Nullable(Type.Array(Type.String())),
    })
  ),
  // TODO: Available starting in epoch3, only included in blocks where the pox cycle rewards are first calculated
  // cycle_number: Nullable(Type.Integer()),
  // reward_set: Nullable(
  //   Type.Object({
  //     pox_ustx_threshold: Type.String(),
  //     rewarded_addresses: Type.Array(Type.String()),
  //     signers: Nullable(
  //       Type.Array(
  //         Type.Object({
  //           signing_key: Type.String(),
  //           weight: Type.Integer(),
  //           stacked_amt: Type.String(),
  //         })
  //       )
  //     ),
  //   })
  // ),
});
export type BlockMetadata = Static<typeof BlockMetadataSchema>;

export const BlockSchema = Type.Object({
  block_identifier: BlockIdentifierSchema,
  parent_block_identifier: BlockIdentifierSchema,
  timestamp: Type.Integer(),
  transactions: Type.Array(TransactionSchema),
  metadata: Type.Optional(BlockMetadataSchema),
});
export type Block = Static<typeof BlockSchema>;
