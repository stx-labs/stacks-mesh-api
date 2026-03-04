import { NetworkIdentifierSchema } from '../entities/network.js';
import { Static, Type } from '@sinclair/typebox';
import { AmountSchema } from '../entities/operations.js';
import {
  ConstructionMetadataSchema,
  ConstructionOperationSchema,
  ConstructionOptionsSchema,
  PublicKeySchema,
  SignatureSchema,
} from '../entities/construction.js';

export const ConstructionDeriveRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  public_key: PublicKeySchema,
});
export type ConstructionDeriveRequest = Static<typeof ConstructionDeriveRequestSchema>;

export const ConstructionPreprocessRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(ConstructionOperationSchema),
  max_fee: Type.Optional(Type.Array(AmountSchema)),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});
export type ConstructionPreprocessRequest = Static<typeof ConstructionPreprocessRequestSchema>;

export const ConstructionMetadataRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  options: ConstructionOptionsSchema,
  public_keys: Type.Array(PublicKeySchema, { minItems: 1 }),
});
export type ConstructionMetadataRequest = Static<typeof ConstructionMetadataRequestSchema>;

export const ConstructionPayloadsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(ConstructionOperationSchema),
  metadata: ConstructionMetadataSchema,
  public_keys: Type.Array(PublicKeySchema, { minItems: 1 }),
});
export type ConstructionPayloadsRequest = Static<typeof ConstructionPayloadsRequestSchema>;

export const ConstructionCombineRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  unsigned_transaction: Type.String(),
  signatures: Type.Array(SignatureSchema),
});
export type ConstructionCombineRequest = Static<typeof ConstructionCombineRequestSchema>;

export const ConstructionParseRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed: Type.Boolean(),
  transaction: Type.String(),
});
export type ConstructionParseRequest = Static<typeof ConstructionParseRequestSchema>;

export const ConstructionHashRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});
export type ConstructionHashRequest = Static<typeof ConstructionHashRequestSchema>;

export const ConstructionSubmitRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});
export type ConstructionSubmitRequest = Static<typeof ConstructionSubmitRequestSchema>;
