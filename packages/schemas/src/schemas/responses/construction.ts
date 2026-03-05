import { Static, Type } from '@sinclair/typebox';
import { AccountIndentifierSchema, HexStringSchema } from '../entities/common.js';
import { AmountSchema, OperationSchema } from '../entities/operations.js';
import { TransactionIdentifierSchema } from '../entities/common.js';
import {
  ConstructionMetadataSchema,
  ConstructionOptionsSchema,
  SigningPayloadSchema,
} from '../entities/construction.js';

export const ConstructionDeriveResponseSchema = Type.Object({
  address: Type.Optional(Type.String()),
  account_identifier: Type.Optional(AccountIndentifierSchema),
});
export type ConstructionDeriveResponse = Static<typeof ConstructionDeriveResponseSchema>;

export const ConstructionPreprocessResponseSchema = Type.Object({
  options: Type.Optional(ConstructionOptionsSchema),
  required_public_keys: Type.Optional(Type.Array(AccountIndentifierSchema)),
});
export type ConstructionPreprocessResponse = Static<typeof ConstructionPreprocessResponseSchema>;

export const ConstructionMetadataResponseSchema = Type.Object({
  metadata: ConstructionMetadataSchema,
  suggested_fee: Type.Optional(Type.Array(AmountSchema)),
});
export type ConstructionMetadataResponse = Static<typeof ConstructionMetadataResponseSchema>;

export const ConstructionPayloadsResponseSchema = Type.Object({
  unsigned_transaction: HexStringSchema,
  payloads: Type.Array(SigningPayloadSchema),
});
export type ConstructionPayloadsResponse = Static<typeof ConstructionPayloadsResponseSchema>;

export const ConstructionCombineResponseSchema = Type.Object({
  signed_transaction: HexStringSchema,
});
export type ConstructionCombineResponse = Static<typeof ConstructionCombineResponseSchema>;

export const ConstructionParseResponseSchema = Type.Object({
  operations: Type.Array(OperationSchema),
  signers: Type.Optional(Type.Array(Type.String())),
  account_identifier_signers: Type.Optional(Type.Array(AccountIndentifierSchema)),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ConstructionParseResponse = Static<typeof ConstructionParseResponseSchema>;

export const TransactionIdentifierResponseSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type TransactionIdentifierResponse = Static<typeof TransactionIdentifierResponseSchema>;
