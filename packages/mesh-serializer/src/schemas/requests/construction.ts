import { NetworkIdentifierSchema } from '../entities/network.js';
import { Static, Type } from '@sinclair/typebox';
import { AmountSchema, OperationSchema } from '../entities/operations.js';
import { AccountIndentifierSchema } from '../entities/common.js';

export const PublicKeySchema = Type.Object({
  hex_bytes: Type.String(),
  curve_type: Type.Union([
    Type.Literal('secp256k1'),
    Type.Literal('secp256r1'),
    Type.Literal('edwards25519'),
    Type.Literal('tweedle'),
    Type.Literal('pallas'),
  ]),
});
export type PublicKey = Static<typeof PublicKeySchema>;

export const SigningPayloadSchema = Type.Object({
  address: Type.Optional(Type.String()),
  account_identifier: Type.Optional(AccountIndentifierSchema),
  hex_bytes: Type.String(),
  signature_type: Type.Optional(
    Type.Union([
      Type.Literal('ecdsa'),
      Type.Literal('ecdsa_recovery'),
      Type.Literal('ed25519'),
      Type.Literal('schnorr_1'),
      Type.Literal('schnorr_bip340'),
      Type.Literal('schnorr_poseidon'),
    ])
  ),
});
export type SigningPayload = Static<typeof SigningPayloadSchema>;

export const SignatureSchema = Type.Object({
  signing_payload: SigningPayloadSchema,
  public_key: PublicKeySchema,
  signature_type: Type.Union([
    Type.Literal('ecdsa'),
    Type.Literal('ecdsa_recovery'),
    Type.Literal('ed25519'),
    Type.Literal('schnorr_1'),
    Type.Literal('schnorr_bip340'),
    Type.Literal('schnorr_poseidon'),
  ]),
  hex_bytes: Type.String(),
});
export type Signature = Static<typeof SignatureSchema>;

export const ConstructionDeriveRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  public_key: PublicKeySchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ConstructionDeriveRequest = Static<typeof ConstructionDeriveRequestSchema>;

export const ConstructionPreprocessRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(OperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  max_fee: Type.Optional(Type.Array(AmountSchema)),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});
export type ConstructionPreprocessRequest = Static<typeof ConstructionPreprocessRequestSchema>;

export const ConstructionMetadataRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  public_keys: Type.Optional(Type.Array(PublicKeySchema)),
});
export type ConstructionMetadataRequest = Static<typeof ConstructionMetadataRequestSchema>;

export const ConstructionPayloadsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(OperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  public_keys: Type.Optional(Type.Array(PublicKeySchema)),
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
