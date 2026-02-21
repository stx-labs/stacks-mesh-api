import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";
import { TransactionIdentifierSchema } from "../entities/common.js";

export const MempoolRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
});
export type MempoolRequest = Static<typeof MempoolRequestSchema>;

export const MempoolTransactionRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  transaction_identifier: TransactionIdentifierSchema,
});
export type MempoolTransactionRequest = Static<typeof MempoolTransactionRequestSchema>;
