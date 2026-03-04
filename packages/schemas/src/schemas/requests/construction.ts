import { NetworkIdentifierSchema } from '../entities/network.js';
import { Static, Type } from '@sinclair/typebox';
import { AmountSchema } from '../entities/operations.js';
import {
  AccountIndentifierSchema,
  Nullable,
  OperationIdentifierSchema,
} from '../entities/common.js';

export const PublicKeySchema = Type.Object({
  hex_bytes: Type.String(),
  curve_type: Type.Literal('secp256k1'),
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

// ────────────────────────────────────────────────────────────────────────────
// /construction/derive
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionDeriveRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  public_key: PublicKeySchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ConstructionDeriveRequest = Static<typeof ConstructionDeriveRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/preprocess
// ────────────────────────────────────────────────────────────────────────────

const BaseConstructionPreprocessOptionsSchema = Type.Object({
  sender_address: Type.String(),
  max_fee: Type.Optional(Type.String()),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});

export const ConstructionPreprocessContractCallOptionsSchema = Type.Composite([
  BaseConstructionPreprocessOptionsSchema,
  Type.Object({
    type: Type.Literal('contract_call'),
    contract_identifier: Type.String(),
    function_name: Type.String(),
    args: Type.Array(Type.String()),
  }),
]);
export type ConstructionPreprocessContractCallOptions = Static<
  typeof ConstructionPreprocessContractCallOptionsSchema
>;

export const ConstructionPreprocessTokenTransferOptionsSchema = Type.Composite([
  BaseConstructionPreprocessOptionsSchema,
  Type.Object({
    type: Type.Literal('token_transfer'),
    recipient_address: Type.String(),
    amount: Type.String(),
    memo: Type.Optional(Type.String()),
  }),
]);
export type ConstructionPreprocessTokenTransferOptions = Static<
  typeof ConstructionPreprocessTokenTransferOptionsSchema
>;

export const ConstructionPreprocessContractDeployOptionsSchema = Type.Composite([
  BaseConstructionPreprocessOptionsSchema,
  Type.Object({
    type: Type.Literal('contract_deploy'),
    contract_name: Type.String(),
    clarity_version: Type.Optional(Type.Integer()),
    source_code: Type.String(),
  }),
]);
export type ConstructionPreprocessContractDeployOptions = Static<
  typeof ConstructionPreprocessContractDeployOptionsSchema
>;

export const ConstructionPreprocessOptionsSchema = Type.Union([
  ConstructionPreprocessContractCallOptionsSchema,
  ConstructionPreprocessTokenTransferOptionsSchema,
  ConstructionPreprocessContractDeployOptionsSchema,
]);
export type ConstructionPreprocessOptions = Static<typeof ConstructionPreprocessOptionsSchema>;

const ConstructionTokenTransferOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  type: Type.Literal('token_transfer'),
  account: AccountIndentifierSchema,
  amount: AmountSchema,
  metadata: Type.Optional(Type.Object({ memo: Nullable(Type.String()) })),
});
export type ConstructionTokenTransferOperation = Static<
  typeof ConstructionTokenTransferOperationSchema
>;

const ConstructionContractCallOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  type: Type.Literal('contract_call'),
  account: AccountIndentifierSchema,
  metadata: Type.Object({
    contract_identifier: Type.String(),
    function_name: Type.String(),
    args: Type.Array(Type.String()),
  }),
});
export type ConstructionContractCallOperation = Static<
  typeof ConstructionContractCallOperationSchema
>;

const ConstructionContractDeployOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  type: Type.Literal('contract_deploy'),
  account: AccountIndentifierSchema,
  metadata: Type.Object({
    contract_name: Type.String(),
    clarity_version: Type.Optional(Type.Integer()),
    source_code: Type.String(),
  }),
});
export type ConstructionContractDeployOperation = Static<
  typeof ConstructionContractDeployOperationSchema
>;

export const ConstructionOperationSchema = Type.Union([
  ConstructionTokenTransferOperationSchema,
  ConstructionContractCallOperationSchema,
  ConstructionContractDeployOperationSchema,
]);
export type ConstructionOperation = Static<typeof ConstructionOperationSchema>;

export const ConstructionPreprocessRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(ConstructionOperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  max_fee: Type.Optional(Type.Array(AmountSchema)),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});
export type ConstructionPreprocessRequest = Static<typeof ConstructionPreprocessRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/metadata
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionMetadataRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  options: ConstructionPreprocessOptionsSchema,
  public_keys: Type.Array(PublicKeySchema, { minItems: 1 }),
});
export type ConstructionMetadataRequest = Static<typeof ConstructionMetadataRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/payloads
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionPayloadsRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  operations: Type.Array(ConstructionOperationSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  public_keys: Type.Optional(Type.Array(PublicKeySchema)),
});
export type ConstructionPayloadsRequest = Static<typeof ConstructionPayloadsRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/combine
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionCombineRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  unsigned_transaction: Type.String(),
  signatures: Type.Array(SignatureSchema),
});
export type ConstructionCombineRequest = Static<typeof ConstructionCombineRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/parse
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionParseRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed: Type.Boolean(),
  transaction: Type.String(),
});
export type ConstructionParseRequest = Static<typeof ConstructionParseRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/hash
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionHashRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});
export type ConstructionHashRequest = Static<typeof ConstructionHashRequestSchema>;

// ────────────────────────────────────────────────────────────────────────────
// /construction/submit
// ────────────────────────────────────────────────────────────────────────────

export const ConstructionSubmitRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  signed_transaction: Type.String(),
});
export type ConstructionSubmitRequest = Static<typeof ConstructionSubmitRequestSchema>;
