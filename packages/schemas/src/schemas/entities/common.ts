import { Static, TSchema, Type } from '@sinclair/typebox';

export const HexStringSchema = Type.String({ pattern: '^0x[0-9a-fA-F]+$' });
export type HexString = Static<typeof HexStringSchema>;

export const DecodedClarityValueSchema = Type.Object({
  hex: Type.String(),
  repr: Type.String(),
  type: Type.String(),
});
export type DecodedClarityValue = Static<typeof DecodedClarityValueSchema>;

export const StacksContractIdentifierSchema = Type.String({
  pattern:
    '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{28,41}\\.[a-zA-Z]([a-zA-Z0-9]|[-_]){0,39}$',
});
export type StacksContractIdentifier = Static<
  typeof StacksContractIdentifierSchema
>;

export const StacksAddressSchema = Type.String({
  pattern: '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{28,41}$',
});
export type StacksAddress = Static<typeof StacksAddressSchema>;

export const StacksPrincipalSchema = Type.Union([
  StacksContractIdentifierSchema,
  StacksAddressSchema,
]);
export type StacksPrincipal = Static<typeof StacksPrincipalSchema>;

export const OperationIdentifierSchema = Type.Object({
  index: Type.Integer(),
  network_index: Type.Optional(Type.Integer()),
});
export type OperationIdentifier = Static<typeof OperationIdentifierSchema>;

export const SubAccountIdentifierSchema = Type.Object({
  address: Type.String(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type SubAccountIdentifier = Static<typeof SubAccountIdentifierSchema>;

export const AccountIndentifierSchema = Type.Object({
  address: StacksPrincipalSchema,
  sub_account: Type.Optional(SubAccountIdentifierSchema),
});
export type AccountIdentifier = Static<typeof AccountIndentifierSchema>;

export const BlockIdentifierSchema = Type.Object({
  index: Type.Integer({ minimum: 1 }),
  hash: HexStringSchema,
});
export type BlockIdentifier = Static<typeof BlockIdentifierSchema>;

export const TransactionIdentifierSchema = Type.Object({
  hash: HexStringSchema,
});
export type TransactionIdentifier = Static<typeof TransactionIdentifierSchema>;

export const ExecutionCostSchema = Type.Object({
  read_count: Type.Integer(),
  read_length: Type.Integer(),
  runtime: Type.Integer(),
  write_count: Type.Integer(),
  write_length: Type.Integer(),
});
export type ExecutionCost = Static<typeof ExecutionCostSchema>;

export const StatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('success'),
  Type.Literal('abort_by_response'),
  Type.Literal('abort_by_post_condition'),
  Type.Literal('dropped_replace_by_fee'),
  Type.Literal('dropped_replace_across_fork'),
  Type.Literal('dropped_too_expensive'),
  Type.Literal('dropped_problematic'),
  Type.Literal('dropped_stale_garbage_collect'),
]);
export type Status = Static<typeof StatusSchema>;

export const Nullable = <T extends TSchema>(type: T) => Type.Union([type, Type.Null()]);

export const Optional = <T extends TSchema>(type: T) => Type.Optional(type);
