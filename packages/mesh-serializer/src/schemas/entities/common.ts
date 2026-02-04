import { Static, TSchema, Type } from '@sinclair/typebox';

export const OperationIdentifierSchema = Type.Object({
  index: Type.Integer(),
  network_index: Type.Optional(Type.Integer()),
});
export type OperationIdentifier = Static<typeof OperationIdentifierSchema>;

export const AccountIndentifierSchema = Type.Object({
  address: Type.String(),
  sub_account: Type.Optional(Type.String()),
});
export type AccountIdentifier = Static<typeof AccountIndentifierSchema>;

export const BlockIdentifierSchema = Type.Object({
  index: Type.Integer(),
  hash: Type.String(),
});
export type BlockIdentifier = Static<typeof BlockIdentifierSchema>;

export const TransactionIdentifierSchema = Type.Object({
  hash: Type.String(),
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

export const Nullable = <T extends TSchema>(type: T) =>
  Type.Union([type, Type.Null()]);

export const Optional = <T extends TSchema>(type: T) => Type.Optional(type);
