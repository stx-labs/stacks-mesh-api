import { Static, Type } from '@sinclair/typebox';
import { AccountIndentifierSchema, AmountSchema } from '../index.js';
import { Nullable, OperationIdentifierSchema } from './common.js';

export const PublicKeySchema = Type.Object({
  hex_bytes: Type.String(),
  curve_type: Type.Literal('secp256k1'),
});
export type PublicKey = Static<typeof PublicKeySchema>;

export const SigningPayloadSchema = Type.Object({
  address: Type.String(),
  account_identifier: AccountIndentifierSchema,
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

const BaseConstructionOptionsSchema = Type.Object({
  sender_address: Type.String(),
  max_fee: Type.Optional(Type.String()),
  suggested_fee_multiplier: Type.Optional(Type.Number()),
});

export const ConstructionContractCallOptionsSchema = Type.Composite([
  BaseConstructionOptionsSchema,
  Type.Object({
    type: Type.Literal('contract_call'),
    contract_identifier: Type.String(),
    function_name: Type.String(),
    args: Type.Array(Type.String()),
  }),
]);
export type ConstructionContractCallOptions = Static<typeof ConstructionContractCallOptionsSchema>;

export const ConstructionTokenTransferOptionsSchema = Type.Composite([
  BaseConstructionOptionsSchema,
  Type.Object({
    type: Type.Literal('token_transfer'),
    recipient_address: Type.String(),
    amount: Type.String(),
    memo: Type.Optional(Type.String()),
  }),
]);
export type ConstructionTokenTransferOptions = Static<
  typeof ConstructionTokenTransferOptionsSchema
>;

export const ConstructionContractDeployOptionsSchema = Type.Composite([
  BaseConstructionOptionsSchema,
  Type.Object({
    type: Type.Literal('contract_deploy'),
    contract_name: Type.String(),
    clarity_version: Type.Optional(Type.Integer()),
    source_code: Type.String(),
  }),
]);
export type ConstructionContractDeployOptions = Static<
  typeof ConstructionContractDeployOptionsSchema
>;

export const ConstructionOptionsSchema = Type.Union([
  ConstructionContractCallOptionsSchema,
  ConstructionTokenTransferOptionsSchema,
  ConstructionContractDeployOptionsSchema,
]);
export type ConstructionOptions = Static<typeof ConstructionOptionsSchema>;

export const ConstructionMetadataSchema = Type.Object({
  options: ConstructionOptionsSchema,
  sender_account_info: Type.Object({
    nonce: Type.Number(),
    balance: Type.String(),
  }),
});
export type ConstructionMetadata = Static<typeof ConstructionMetadataSchema>;

export const ConstructionFeeOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  type: Type.Literal('fee'),
  account: AccountIndentifierSchema,
  amount: AmountSchema,
});
export type ConstructionFeeOperation = Static<typeof ConstructionFeeOperationSchema>;

export const ConstructionTokenTransferOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  type: Type.Literal('token_transfer'),
  account: AccountIndentifierSchema,
  amount: AmountSchema,
  metadata: Type.Optional(Type.Object({ memo: Nullable(Type.String()) })),
});
export type ConstructionTokenTransferOperation = Static<
  typeof ConstructionTokenTransferOperationSchema
>;

export const ConstructionContractCallOperationSchema = Type.Object({
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

export const ConstructionContractDeployOperationSchema = Type.Object({
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
  ConstructionFeeOperationSchema,
]);
export type ConstructionOperation = Static<typeof ConstructionOperationSchema>;
