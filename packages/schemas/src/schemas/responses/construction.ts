import { Static, Type } from '@sinclair/typebox';
import { AccountIndentifierSchema } from '../entities/common.js';
import { AmountSchema, OperationSchema } from '../entities/operations.js';
import {
  ConstructionPreprocessOptionsSchema,
  SigningPayloadSchema,
} from '../requests/construction.js';
import { TransactionIdentifierSchema } from '../entities/common.js';

// ────────────────────────────────────────────────────────────────────────────
// /construction/derive
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionDeriveResponseSchema = Type.Object({
  address: Type.Optional(Type.String()),
  account_identifier: Type.Optional(AccountIndentifierSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ConstructionDeriveResponse = Static<typeof ConstructionDeriveResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/preprocess
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionPreprocessResponseSchema = Type.Object({
  options: Type.Optional(ConstructionPreprocessOptionsSchema),
  required_public_keys: Type.Optional(Type.Array(AccountIndentifierSchema)),
});
export type ConstructionPreprocessResponse = Static<typeof ConstructionPreprocessResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/metadata
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionMetadataResponseSchema = Type.Object({
  metadata: Type.Object({
    options: ConstructionPreprocessOptionsSchema,
    sender_account_info: Type.Object({
      nonce: Type.Number(),
      balance: Type.String(),
    }),
  }),
  suggested_fee: Type.Optional(Type.Array(AmountSchema)),
});
export type ConstructionMetadataResponse = Static<typeof ConstructionMetadataResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/payloads
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionPayloadsResponseSchema = Type.Object({
  unsigned_transaction: Type.String(),
  payloads: Type.Array(SigningPayloadSchema),
});
export type ConstructionPayloadsResponse = Static<typeof ConstructionPayloadsResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/combine
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionCombineResponseSchema = Type.Object({
  signed_transaction: Type.String(),
});
export type ConstructionCombineResponse = Static<typeof ConstructionCombineResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/parse
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionParseResponseSchema = Type.Object({
  operations: Type.Array(OperationSchema),
  signers: Type.Optional(Type.Array(Type.String())),
  account_identifier_signers: Type.Optional(Type.Array(AccountIndentifierSchema)),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ConstructionParseResponse = Static<typeof ConstructionParseResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/hash
// ────────────────────────────────────────────────────────────────────────────

export const TransactionIdentifierResponseSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type TransactionIdentifierResponse = Static<typeof TransactionIdentifierResponseSchema>;
