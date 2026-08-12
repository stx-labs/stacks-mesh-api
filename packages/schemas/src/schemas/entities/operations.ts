import { Static, Type } from '@sinclair/typebox';
import {
  AccountIdentifierSchema,
  DecodedClarityValueSchema,
  Nullable,
  OperationIdentifierSchema,
  StatusSchema,
} from './common.js';

export const CurrencySchema = Type.Object({
  symbol: Type.String(),
  decimals: Type.Integer(),
  metadata: Type.Optional(
    Type.Object({
      asset_identifier: Nullable(Type.String()),
      name: Type.Optional(Type.String()),
      value: Type.Optional(Type.String()),
      token_type: Type.Union([Type.Literal('ft'), Type.Literal('nft')]),
    })
  ),
});
export type Currency = Static<typeof CurrencySchema>;

export const AmountSchema = Type.Object({
  value: Type.String(),
  currency: CurrencySchema,
});
export type Amount = Static<typeof AmountSchema>;

const BaseOperationSchema = Type.Object({
  operation_identifier: OperationIdentifierSchema,
  related_operations: Type.Optional(Type.Array(OperationIdentifierSchema)),
  status: StatusSchema,
});

const BaseAccountOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    account: AccountIdentifierSchema,
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
          Type.Composite([
            DecodedClarityValueSchema,
            Type.Object({
              name: Type.String(),
            }),
          ])
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
      cause: Type.Union([
        Type.Literal('block_found'),
        Type.Literal('extended'),
        Type.Literal('extended_runtime'),
        Type.Literal('extended_read_count'),
        Type.Literal('extended_read_length'),
        Type.Literal('extended_write_count'),
        Type.Literal('extended_write_length'),
      ]),
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

const BasePoxOperationMetadataSchema = Type.Object({
  locked: Type.String(),
  balance: Type.String(),
  burnchain_unlock_height: Type.Integer(),
  pox_addr: Type.Optional(Type.String()),
  pox_addr_raw: Type.Optional(Type.String()),
});

const DelegateStxOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('delegate_stx'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        amount_ustx: Type.String(),
        delegate_to: Type.String(),
        unlock_burn_height: Nullable(Type.Integer()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type DelegateStxOperation = Static<typeof DelegateStxOperationSchema>;

const DelegateStackStxOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('delegate_stack_stx'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        lock_amount: Type.String(),
        lock_period: Type.String(),
        delegator: Type.String(),
        burnchain_start_height: Nullable(Type.Integer()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type DelegateStackStxOperation = Static<typeof DelegateStackStxOperationSchema>;

const RevokeDelegateStxOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('revoke_delegate_stx'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        delegate_to: Type.String(),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type RevokeDelegateStxOperation = Static<typeof RevokeDelegateStxOperationSchema>;

const DelegateStackIncreaseOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('delegate_stack_increase'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        increase_by: Type.String(),
        delegator: Type.String(),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type DelegateStackIncreaseOperation = Static<typeof DelegateStackIncreaseOperationSchema>;

const StackAggregationIncreaseOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_aggregation_increase'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        amount_ustx: Type.String(),
        reward_cycle: Type.Integer(),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackAggregationIncreaseOperation = Static<
  typeof StackAggregationIncreaseOperationSchema
>;

const StackAggregationCommitOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_aggregation_commit'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        amount_ustx: Type.String(),
        reward_cycle: Type.Integer(),
        signer_key: Nullable(Type.String()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackAggregationCommitOperation = Static<typeof StackAggregationCommitOperationSchema>;

const StackAggregationCommitIndexedOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_aggregation_commit_indexed'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        amount_ustx: Type.String(),
        reward_cycle: Type.Integer(),
        signer_key: Nullable(Type.String()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackAggregationCommitIndexedOperation = Static<
  typeof StackAggregationCommitIndexedOperationSchema
>;

const DelegateStackExtendOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('delegate_stack_extend'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        extend_count: Type.Integer(),
        delegator: Type.String(),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type DelegateStackExtendOperation = Static<typeof DelegateStackExtendOperationSchema>;

const HandleUnlockOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('handle_unlock'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        first_cycle_locked: Type.Integer(),
        first_unlocked_cycle: Type.Integer(),
      }),
    ]),
  }),
]);
export type HandleUnlockOperation = Static<typeof HandleUnlockOperationSchema>;

const StackStxOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_stx'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        lock_amount: Type.String(),
        lock_period: Type.Integer(),
        burnchain_start_height: Type.Integer(),
        signer_key: Nullable(Type.String()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackStxOperation = Static<typeof StackStxOperationSchema>;

const StackIncreaseOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_increase'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        increase_by: Type.String(),
        signer_key: Nullable(Type.String()),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackIncreaseOperation = Static<typeof StackIncreaseOperationSchema>;

const StackExtendOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stack_extend'),
    metadata: Type.Composite([
      BasePoxOperationMetadataSchema,
      Type.Object({
        extend_count: Type.Integer(),
        start_cycle_id: Nullable(Type.Integer()),
        end_cycle_id: Nullable(Type.Integer()),
      }),
    ]),
  }),
]);
export type StackExtendOperation = Static<typeof StackExtendOperationSchema>;

const ContractLogOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('contract_log'),
    metadata: Type.Object({
      contract_identifier: Type.String(),
      topic: Type.String(),
      value: Type.Union([Type.String(), DecodedClarityValueSchema]),
    }),
  }),
]);
export type ContractLogOperation = Static<typeof ContractLogOperationSchema>;

// ── pox-5 (bitcoin staking) operations ───────────────────────────────────────
// pox-5 events have no `locked`/`balance`/`burnchain_unlock_height` envelope (unlike
// pox-4), so these do NOT compose BasePoxOperationMetadataSchema — the post-event
// spendable balance must be read from the node, not derived from the operation.

const StakeOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stake'),
    metadata: Type.Object({
      amount_ustx: Type.String(),
      signer: Type.String(),
      num_cycles: Type.Integer(),
      first_reward_cycle: Type.Integer(),
      unlock_burn_height: Type.Integer(),
      unlock_cycle: Type.Integer(),
    }),
  }),
]);
export type StakeOperation = Static<typeof StakeOperationSchema>;

const StakeUpdateOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('stake_update'),
    metadata: Type.Object({
      amount_ustx: Type.String(),
      signer: Type.String(),
      old_signer: Type.String(),
      amount_increase: Type.String(),
      num_cycles: Type.Integer(),
      cycles_to_extend: Type.Integer(),
      prev_unlock_height: Type.Integer(),
      unlock_burn_height: Type.Integer(),
      unlock_cycle: Type.Integer(),
    }),
  }),
]);
export type StakeUpdateOperation = Static<typeof StakeUpdateOperationSchema>;

const UnstakeOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('unstake'),
    metadata: Type.Object({
      amount_ustx: Type.String(),
      signer: Type.String(),
      first_reward_cycle: Type.Integer(),
      unlock_cycle: Type.Integer(),
      unlock_burn_height: Type.Integer(),
    }),
  }),
]);
export type UnstakeOperation = Static<typeof UnstakeOperationSchema>;

const RegisterForBondOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('register_for_bond'),
    metadata: Type.Object({
      amount_ustx: Type.String(),
      signer: Type.String(),
      bond_index: Type.Integer(),
      sats_total: Type.String(),
      is_l1_lock: Type.Boolean(),
      first_reward_cycle: Type.Integer(),
      unlock_burn_height: Type.Integer(),
      unlock_cycle: Type.Integer(),
      // How the BTC was locked: `type: 'l1'` with proof outputs, or `type: 'l2'` (sBTC) with null.
      btc_lockup: Type.Object({
        type: Type.String(),
        txs: Nullable(
          Type.Array(Type.Object({ txid: Type.String(), output_index: Type.String() }))
        ),
      }),
    }),
  }),
]);
export type RegisterForBondOperation = Static<typeof RegisterForBondOperationSchema>;

// Updating a bond registration can change the locked STX amount (like `stake_update` for bonds).
const UpdateBondRegistrationOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('update_bond_registration'),
    metadata: Type.Object({
      amount_ustx: Type.String(),
      signer: Type.String(),
      old_signer: Type.String(),
      bond_index: Type.Integer(),
      amount_sats: Type.String(),
      first_reward_cycle: Type.Integer(),
      num_cycles: Type.Integer(),
      is_l1_lock: Type.Boolean(),
    }),
  }),
]);
export type UpdateBondRegistrationOperation = Static<typeof UpdateBondRegistrationOperationSchema>;

// The remaining pox-5 events (bond/signer administration, reward accounting, and non-STX asset
// movements like sBTC unstakes) don't move an STX balance, so they carry no `amount`. They're
// surfaced so every pox-5 event is visible in a transaction, each with its own typed metadata.

const SetBondAdminOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('set_bond_admin'),
    metadata: Type.Object({
      old_admin: Type.String(),
      new_admin: Type.String(),
    }),
  }),
]);
export type SetBondAdminOperation = Static<typeof SetBondAdminOperationSchema>;

const SetupBondOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('setup_bond'),
    metadata: Type.Object({
      bond_index: Type.Integer(),
      target_rate: Type.Integer(),
      stx_value_ratio: Type.String(),
      min_ustx_ratio: Type.String(),
      early_unlock_bytes: Type.String(),
      first_reward_cycle: Type.Integer(),
      bond_start_height: Type.Integer(),
      unlock_cycle: Type.Integer(),
      unlock_burn_height: Type.Integer(),
    }),
  }),
]);
export type SetupBondOperation = Static<typeof SetupBondOperationSchema>;

const AddToAllowlistOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('add_to_allowlist'),
    metadata: Type.Object({
      max_sats: Type.String(),
      bond_index: Type.Integer(),
    }),
  }),
]);
export type AddToAllowlistOperation = Static<typeof AddToAllowlistOperationSchema>;

const RegisterSignerOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('register_signer'),
    metadata: Type.Object({
      signer_key: Type.String(),
    }),
  }),
]);
export type RegisterSignerOperation = Static<typeof RegisterSignerOperationSchema>;

const AnnounceL1EarlyExitOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('announce_l1_early_exit'),
    metadata: Type.Object({
      signer: Type.String(),
      bond_index: Type.Integer(),
      amount_sats_released: Type.String(),
    }),
  }),
]);
export type AnnounceL1EarlyExitOperation = Static<typeof AnnounceL1EarlyExitOperationSchema>;

const UnstakeSbtcOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('unstake_sbtc'),
    metadata: Type.Object({
      signer: Type.String(),
      bond_index: Type.Integer(),
      amount_withdrawn_sats: Type.String(),
      new_amount_sats: Type.String(),
    }),
  }),
]);
export type UnstakeSbtcOperation = Static<typeof UnstakeSbtcOperationSchema>;

const CalculateRewardsOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('calculate_rewards'),
    metadata: Type.Object({
      bond_periods: Type.Array(Type.String()),
      calculation_height: Type.Integer(),
      gross_accrued_rewards: Type.String(),
      total_bond_rewards: Type.String(),
      reserve_deposit: Type.String(),
      reserve_balance: Type.String(),
      stx_cycle: Type.Integer(),
      total_stx_staker_rewards: Type.String(),
      cycle_staked_ustx: Type.String(),
      accrued_rewards_per_ustx: Type.String(),
      cumulative_rewards_per_ustx: Type.String(),
    }),
  }),
]);
export type CalculateRewardsOperation = Static<typeof CalculateRewardsOperationSchema>;

const BondDistributionOperationSchema = Type.Composite([
  BaseOperationSchema,
  Type.Object({
    type: Type.Literal('bond_distribution'),
    metadata: Type.Object({
      bond_index: Type.Integer(),
      target_yield: Type.String(),
      bond_rewards: Type.String(),
      bond_staked_sats: Type.String(),
      accrued_rewards_per_sat: Type.String(),
      cumulative_rewards_per_sat: Type.String(),
    }),
  }),
]);
export type BondDistributionOperation = Static<typeof BondDistributionOperationSchema>;

const ClaimRewardsOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('claim_rewards'),
    metadata: Type.Object({
      reward_cycle: Type.Integer(),
      stx_rewards: Type.Object({
        earned: Type.String(),
        rewards_per_token: Type.String(),
      }),
      bond_rewards: Type.Array(
        Type.Object({
          bond_index: Type.Integer(),
          earned: Type.String(),
          rewards_per_token: Type.String(),
        })
      ),
      bond_totals: Type.String(),
      total_rewards: Type.String(),
    }),
  }),
]);
export type ClaimRewardsOperation = Static<typeof ClaimRewardsOperationSchema>;

const ClaimStakerRewardsForSignerOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('claim_staker_rewards_for_signer'),
    metadata: Type.Object({
      signer_manager: Type.String(),
      reward_cycle: Type.Integer(),
      bond_index: Nullable(Type.Integer()),
      rewards_claimed: Type.String(),
    }),
  }),
]);
export type ClaimStakerRewardsForSignerOperation = Static<
  typeof ClaimStakerRewardsForSignerOperationSchema
>;

const GrantSignerKeyOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('grant_signer_key'),
    metadata: Type.Object({
      signer_key: Type.String(),
      auth_id: Type.String(),
    }),
  }),
]);
export type GrantSignerKeyOperation = Static<typeof GrantSignerKeyOperationSchema>;

const RevokeSignerGrantOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('revoke_signer_grant'),
    metadata: Type.Object({
      signer_key: Type.String(),
    }),
  }),
]);
export type RevokeSignerGrantOperation = Static<typeof RevokeSignerGrantOperationSchema>;

const AllowContractCallerOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('allow_contract_caller'),
    metadata: Type.Object({
      contract_caller: Type.String(),
      until_burn_ht: Nullable(Type.Integer()),
    }),
  }),
]);
export type AllowContractCallerOperation = Static<typeof AllowContractCallerOperationSchema>;

const DisallowContractCallerOperationSchema = Type.Composite([
  BaseAccountOperationSchema,
  Type.Object({
    type: Type.Literal('disallow_contract_caller'),
    metadata: Type.Object({
      contract_caller: Type.String(),
    }),
  }),
]);
export type DisallowContractCallerOperation = Static<typeof DisallowContractCallerOperationSchema>;

// pox-5 (bitcoin staking) operations, grouped into their own union. Referencing this once in the
// main `OperationSchema` keeps that union small enough to avoid TS "excessively deep" instantiation
// errors from the response-schema type provider.
const Pox5OperationSchema = Type.Union([
  StakeOperationSchema,
  StakeUpdateOperationSchema,
  UnstakeOperationSchema,
  RegisterForBondOperationSchema,
  UpdateBondRegistrationOperationSchema,
  SetBondAdminOperationSchema,
  SetupBondOperationSchema,
  AddToAllowlistOperationSchema,
  RegisterSignerOperationSchema,
  AnnounceL1EarlyExitOperationSchema,
  UnstakeSbtcOperationSchema,
  CalculateRewardsOperationSchema,
  BondDistributionOperationSchema,
  ClaimRewardsOperationSchema,
  ClaimStakerRewardsForSignerOperationSchema,
  GrantSignerKeyOperationSchema,
  RevokeSignerGrantOperationSchema,
  AllowContractCallerOperationSchema,
  DisallowContractCallerOperationSchema,
]);
export type Pox5Operation = Static<typeof Pox5OperationSchema>;

export const OperationSchema = Type.Union([
  CoinbaseOperationSchema,
  ContractCallOperationSchema,
  ContractLogOperationSchema,
  DelegateStackExtendOperationSchema,
  DelegateStackIncreaseOperationSchema,
  DelegateStackStxOperationSchema,
  DelegateStxOperationSchema,
  FeeOperationSchema,
  HandleUnlockOperationSchema,
  PoisonMicroblockOperationSchema,
  Pox5OperationSchema,
  RevokeDelegateStxOperationSchema,
  SmartContractOperationSchema,
  StackAggregationCommitIndexedOperationSchema,
  StackAggregationCommitOperationSchema,
  StackAggregationIncreaseOperationSchema,
  StackExtendOperationSchema,
  StackIncreaseOperationSchema,
  StackStxOperationSchema,
  StxLockOperationSchema,
  TenureChangeOperationSchema,
  TokenBurnOperationSchema,
  TokenMintOperationSchema,
  TokenTransferOperationSchema,
]);
export type Operation = Static<typeof OperationSchema>;
