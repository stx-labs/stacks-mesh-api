import { TransactionIdentifierSchema } from '../entities/common.js';
import { Static, Type } from '@sinclair/typebox';
import { BlockSchema } from '../entities/block.js';
import { TransactionSchema } from '../entities/transactions.js';

export const BlockResponseSchema = Type.Object({
  block: Type.Optional(BlockSchema),
  other_transactions: Type.Optional(Type.Array(TransactionIdentifierSchema)),
});
export type BlockResponse = Static<typeof BlockResponseSchema>;

export const BlockTransactionResponseSchema = Type.Object({
  transaction: TransactionSchema,
});
export type BlockTransactionResponse = Static<typeof BlockTransactionResponseSchema>;
