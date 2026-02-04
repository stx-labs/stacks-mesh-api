import { Static, Type } from '@sinclair/typebox';
import {
  AccountIndentifierSchema,
  Nullable,
  OperationIdentifierSchema,
  StatusSchema,
} from './common.js';

export const CurrencySchema = Type.Object({
  decimals: Type.Integer(),
  symbol: Type.String(),
  metadata: Type.Optional(
    Type.Object({
      asset_identifier: Nullable(Type.String()),
      value: Type.Optional(Type.String()),
      token_type: Type.Union([Type.Literal('ft'), Type.Literal('nft')]),
    })
  ),
});
export type Currency = Static<typeof CurrencySchema>;

export const AmountSchema = Type.Object({
  currency: CurrencySchema,
  value: Type.String(),
});
export type Amount = Static<typeof AmountSchema>;

const BaseOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  status: StatusSchema,
});

const BaseAccountOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    account: AccountIndentifierSchema,
  }),
]);

const BaseAmountOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    amount: AmountSchema,
  }),
]);

const CoinbaseOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('coinbase'),
    metadata: Type.Object({
      alt_recipient: Nullable(Type.String()),
      vrf_proof: Nullable(Type.String()),
    }),
  }),
]);
export type CoinbaseOperation = Static<typeof CoinbaseOperationSchema>;

const FeeOperationSchema = Type.Composite([
  BaseAmountOperationSchema,
  Type.Object({
    type: Type.Literal('fee'),
    metadata: Type.Object({
      sponsored: Type.Boolean(),
    }),
  }),
]);
export type FeeOperation = Static<typeof FeeOperationSchema>;

const TokenTransferOperationSchema = Type.Composite([
  BaseAmountOperationSchema,
  Type.Object({
    type: Type.Literal('token_transfer'),
    metadata: Type.Optional(Type.Object({ memo: Nullable(Type.String()) })),
  }),
]);
export type TokenTransferOperation = Static<typeof TokenTransferOperationSchema>;

const TokenMintOperationSchema = Type.Composite([
  BaseAmountOperationSchema,
  Type.Object({
    type: Type.Literal('token_mint'),
  }),
]);
export type TokenMintOperation = Static<typeof TokenMintOperationSchema>;

const TokenBurnOperationSchema = Type.Composite([
  BaseAmountOperationSchema,
  Type.Object({
    type: Type.Literal('token_burn'),
  }),
]);
export type TokenBurnOperation = Static<typeof TokenBurnOperationSchema>;

const ContractCallOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('contract_call'),
    metadata: Type.Object({
      args: Type.Union([
        Type.Array(
          Type.Object({
            hex: Type.String(),
            repr: Type.String(),
            name: Type.String(),
            type: Type.String(),
          })
        ),
        Nullable(Type.String()),
      ]),
      contract_identifier: Type.String(),
      function_name: Type.String(),
    }),
  }),
]);
export type ContractCallOperation = Static<typeof ContractCallOperationSchema>;

const SmartContractOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('contract_deploy'),
    metadata: Type.Object({
      contract_identifier: Type.String(),
      clarity_version: Nullable(Type.Integer()),
      source_code: Type.Optional(Type.String()),
      abi: Type.Optional(Type.String()),
    }),
  }),
]);
export type SmartContractOperation = Static<typeof SmartContractOperationSchema>;

const TenureChangeOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('tenure_change'),
    metadata: Type.Object({
      tenure_consensus_hash: Type.String(),
      prev_tenure_consensus_hash: Type.String(),
      burn_view_consensus_hash: Type.String(),
      previous_tenure_end: Type.String(),
      previous_tenure_blocks: Type.Integer(),
      cause: Type.Union([Type.Literal('block_found'), Type.Literal('extended')]),
      pubkey_hash: Type.String(),
    }),
  }),
]);
export type TenureChangeOperation = Static<typeof TenureChangeOperationSchema>;

const PoisonMicroblockOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('poison_microblock'),
    metadata: Type.Object({
      microblock_header_1: Type.String(),
      microblock_header_2: Type.String(),
    }),
  }),
]);
export type PoisonMicroblockOperation = Static<typeof PoisonMicroblockOperationSchema>;

const StxLockOperationSchema = Type.Composite([
  BaseAmountOperationSchema,
  Type.Object({
    type: Type.Literal('stx_lock'),
    metadata: Type.Object({
      unlock_height: Type.Integer(),
      locked_address: Type.String(),
      contract_name: Type.String(),
    }),
  }),
]);
export type StxLockOperation = Static<typeof StxLockOperationSchema>;

const ContractLogOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('contract_log'),
    metadata: Type.Object({
      contract_identifier: Type.String(),
      topic: Type.String(),
      value: Type.Union([
        Type.String(),
        Type.Object({
          hex: Type.String(),
          repr: Type.String(),
        }),
      ]),
    }),
  }),
]);
export type ContractLogOperation = Static<typeof ContractLogOperationSchema>;

export const OperationSchema = Type.Union([
  CoinbaseOperationSchema,
  FeeOperationSchema,
  TokenTransferOperationSchema,
  ContractCallOperationSchema,
  SmartContractOperationSchema,
  TenureChangeOperationSchema,
  PoisonMicroblockOperationSchema,
  TokenMintOperationSchema,
  TokenBurnOperationSchema,
  StxLockOperationSchema,
  ContractLogOperationSchema,
]);
export type Operation = Static<typeof OperationSchema>;
