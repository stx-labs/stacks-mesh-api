import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";
import { TransactionIdentifierSchema } from "../entities/common.js";

export const MempoolTransactionRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  transaction_identifier: TransactionIdentifierSchema,
});
export type MempoolTransactionRequest = Static<typeof MempoolTransactionRequestSchema>;
