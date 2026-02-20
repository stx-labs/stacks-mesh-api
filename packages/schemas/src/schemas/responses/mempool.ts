import { TransactionIdentifierSchema } from '../entities/common.js';
import { Static, Type } from '@sinclair/typebox';
import { TransactionSchema } from '../entities/transaction.js';

export const MempoolResponseSchema = Type.Object({
  transaction_identifiers: Type.Array(TransactionIdentifierSchema),
});
export type MempoolResponse = Static<typeof MempoolResponseSchema>;

export const MempoolTransactionResponseSchema = Type.Object({
  transaction: TransactionSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type MempoolTransactionResponse = Static<typeof MempoolTransactionResponseSchema>;
