import { BlockIdentifierSchema } from "../entities/common.js";
import { Static, Type } from "@sinclair/typebox";
import { AmountSchema } from "../entities/operations.js";

export const AccountBalanceResponseSchema = Type.Object({
  block_identifier: BlockIdentifierSchema,
  balances: Type.Array(AmountSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type AccountBalanceResponse = Static<typeof AccountBalanceResponseSchema>;
