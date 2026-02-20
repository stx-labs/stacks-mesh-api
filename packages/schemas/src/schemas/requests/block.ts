import { BlockIdentifierSchema, TransactionIdentifierSchema } from '../entities/common.js';
import { NetworkIdentifierSchema } from '../entities/network.js';
import { Static, Type } from '@sinclair/typebox';

export const BlockRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  block_identifier: Type.Partial(BlockIdentifierSchema),
});
export type BlockRequest = Static<typeof BlockRequestSchema>;

export const BlockTransactionRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  block_identifier: Type.Partial(BlockIdentifierSchema),
  transaction_identifier: TransactionIdentifierSchema,
});
export type BlockTransactionRequest = Static<typeof BlockTransactionRequestSchema>;
