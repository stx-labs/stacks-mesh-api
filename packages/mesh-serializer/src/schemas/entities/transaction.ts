import { Static, Type } from '@sinclair/typebox';
import { BlockIdentifierSchema, StatusSchema, TransactionIdentifierSchema } from './common.js';
import { ExecutionCostSchema } from './common.js';
import { Nullable } from './common.js';
import { OperationSchema } from './operations.js';
import { PostConditionModeSchema, PostConditionSchema } from './post_conditions.js';

export const TransactionTypeSchema = Type.Union([
  Type.Literal('coinbase'),
  Type.Literal('token_transfer'),
  Type.Literal('poison_microblock'),
  Type.Literal('contract_deploy'),
  Type.Literal('tenure_change'),
  Type.Literal('contract_call'),
]);
export type TransactionType = Static<typeof TransactionTypeSchema>;

export const TransactionPositionSchema = Type.Object({
  index: Type.Integer(),
  microblock_identifier: Nullable(BlockIdentifierSchema),
});
export type TransactionPosition = Static<typeof TransactionPositionSchema>;

export const TransactionMetadataSchema = Type.Object({
  canonical: Type.Boolean(),
  microblock_canonical: Type.Boolean(),
  execution_cost: ExecutionCostSchema,
  fee_rate: Type.String(),
  nonce: Type.Integer(),
  type: TransactionTypeSchema,
  post_conditions: Type.Optional(
    Type.Object({
      mode: PostConditionModeSchema,
      post_conditions: Type.Array(PostConditionSchema),
    })
  ),
  position: TransactionPositionSchema,
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
  status: StatusSchema,
  vm_error: Nullable(Type.String()),
});
export type TransactionMetadata = Static<typeof TransactionMetadataSchema>;

export const TransactionSchema = Type.Object({
  transaction_identifier: TransactionIdentifierSchema,
  operations: Type.Array(OperationSchema),
  metadata: TransactionMetadataSchema,
});
export type Transaction = Static<typeof TransactionSchema>;
