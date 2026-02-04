import { Static, TSchema, Type } from '@sinclair/typebox';

export const OperationIdentifierSchema = Type.Object({
  index: Type.Integer(),
  network_index: Type.Optional(Type.Integer()),
});
export type OperationIdentifier = Static<typeof OperationIdentifierSchema>;

export const OperationAccountSchema = Type.Object({
  address: Type.String(),
  sub_account: Type.Optional(Type.String()),
});
export type OperationAccount = Static<typeof OperationAccountSchema>;

export const BlockIdentifierSchema = Type.Object({
  index: Type.Integer(),
  hash: Type.String(),
});
export type BlockIdentifier = Static<typeof BlockIdentifierSchema>;

export const TransactionIdentifierSchema = Type.Object({
  hash: Type.String(),
});
export type TransactionIdentifier = Static<typeof TransactionIdentifierSchema>;

export const StacksExecutionCostSchema = Type.Object({
  read_count: Type.Integer(),
  read_length: Type.Integer(),
  runtime: Type.Integer(),
  write_count: Type.Integer(),
  write_length: Type.Integer(),
});
export type StacksExecutionCost = Static<typeof StacksExecutionCostSchema>;

export const Nullable = <T extends TSchema>(type: T) =>
  Type.Union([type, Type.Null()]);

export const Optional = <T extends TSchema>(type: T) => Type.Optional(type);
