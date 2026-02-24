import { Static, Type } from '@sinclair/typebox';
import { BlockIdentifierSchema, Nullable, ExecutionCostSchema } from './common.js';
import { TransactionSchema } from './transaction.js';

export const BlockMetadataSchema = Type.Object({
  canonical: Type.Boolean(),
  burn_block_identifier: Type.Optional(BlockIdentifierSchema),
  burn_block_timestamp: Type.Optional(Type.Integer()),
  parent_microblock_identifier: Type.Optional(BlockIdentifierSchema),
  tenure_height: Type.Optional(Type.Integer()),
  execution_cost: Type.Optional(ExecutionCostSchema),
  tx_total_size: Type.Optional(Type.Integer()),
  tx_count: Type.Optional(Type.Integer()),
  signatures: Type.Optional(
    Type.Object({
      signer_bitvec: Nullable(Type.String()),
      signer_signatures: Nullable(Type.Array(Type.String())),
    })
  ),
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
