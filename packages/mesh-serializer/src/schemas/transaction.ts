import { Static, Type } from '@sinclair/typebox';
import { BlockIdentifierSchema, TransactionIdentifierSchema } from './common.js';
import { StacksExecutionCostSchema } from './common.js';
import { Nullable } from './common.js';
import { StacksOperationSchema } from './operations.js';
import { StacksPostConditionModeSchema, StacksPostConditionSchema } from './post_conditions.js';

export const StacksStatusSchema = Type.Union([
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

export const StacksTransactionTypeSchema = Type.Union([
  Type.Literal('coinbase'),
  Type.Literal('token_transfer'),
  Type.Literal('poison_microblock'),
  Type.Literal('contract_deploy'),
  Type.Literal('tenure_change'),
  Type.Literal('contract_call'),
]);

export const StacksTransactionPositionSchema = Type.Object({
  index: Type.Integer(),
  microblock_identifier: Nullable(BlockIdentifierSchema),
});
export type StacksTransactionPosition = Static<typeof StacksTransactionPositionSchema>;

export const StacksTransactionMetadataSchema = Type.Object({
  canonical: Type.Boolean(),
  microblock_canonical: Type.Boolean(),
  execution_cost: StacksExecutionCostSchema,
  fee_rate: Type.String(),
  nonce: Type.Integer(),
  type: StacksTransactionTypeSchema,
  post_conditions: Type.Optional(
    Type.Object({
      mode: StacksPostConditionModeSchema,
      post_conditions: Type.Array(StacksPostConditionSchema),
    })
  ),
  position: StacksTransactionPositionSchema,
  raw_tx: Type.Optional(Type.String()),
  result: Type.Union([
    Type.String(),
    Type.Object({
      hex: Type.String(),
      repr: Type.String(),
    }),
  ]),
  sender_address: Type.String(),
  sponsor_address: Nullable(Type.String()),
  sponsored: Type.Boolean(),
  status: StacksStatusSchema,
  vm_error: Nullable(Type.String()),
});
export type StacksTransactionMetadata = Static<typeof StacksTransactionMetadataSchema>;

export const StacksTransactionSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  operations: Type.Array(StacksOperationSchema),
  metadata: StacksTransactionMetadataSchema,
});
export type StacksTransaction = Static<typeof StacksTransactionSchema>;
