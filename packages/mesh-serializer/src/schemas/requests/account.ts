import { BlockIdentifierSchema, AccountIndentifierSchema } from "../entities/common.js";
import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";
import { CurrencySchema } from "../entities/operations.js";

export const AccountBalanceRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  account_identifier: AccountIndentifierSchema,
  block_identifier: Type.Optional(BlockIdentifierSchema),
  currencies: Type.Optional(Type.Array(CurrencySchema)),
});
export type AccountBalanceRequest = Static<typeof AccountBalanceRequestSchema>;

export const AccountCoinsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  account_identifier: AccountIndentifierSchema,
  include_mempool: Type.Boolean(),
  currencies: Type.Optional(Type.Array(CurrencySchema)),
});
export type AccountCoinsRequest = Static<typeof AccountCoinsRequestSchema>;
