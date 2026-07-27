import { Operation } from '@stacks/mesh-schemas';
import { logger } from '@stacks/api-toolkit';
// NOTE: the pox event enums/types are NAMED exports of @stacks/codec. They are NOT
// on the default export object, so `codec.Pox5EventName` is `undefined` at runtime —
// always import them by name.
import { Pox5EventName, type Pox5Event } from '@stacks/codec';
import { DecodedStacksTransaction } from './transactions.js';

/**
 * Maps a decoded pox-5 (bitcoin-staking) synthetic print event to a Mesh operation.
 *
 * Knowledge references (source of truth for shapes + semantics):
 * - Event shapes: `@stacks/codec` `Pox5Event*` interfaces (this is the contract; do
 *   not re-derive field names).
 * - Interpretation: how stacks-blockchain-api ingests these — see its
 *   `pg-write-store.ts` pox-5 event switch.
 * - Ground truth for anything ambiguous: stacks-core `pox-5.clar`.
 *
 * These operations are INFORMATIONAL — none carries an `amount`. Following the reference rosetta
 * (stacks-blockchain-api ignored pox print events entirely), the actual balance movement is
 * represented by the separate `stx_lock` / `stx_transfer` / `ft_transfer` events, which the block
 * serializer already turns into balance-affecting operations. Emitting an `amount` here too would
 * double-count (e.g. a `stx_lock` of −N plus a `stake` of +N nets to zero). The staked/updated
 * amounts are kept in `metadata` (`amount_ustx`) for visibility.
 *
 * Key differences from pox-4 (`makeSyntheticPoxOperation`):
 * - pox-5 events have NO top-level `locked` / `balance` / `burnchain_unlock_height` envelope —
 *   everything is inside `data`. Post-event spendable balance must be read from the node.
 * - Rewards are paid in **sBTC** (a SIP-010 asset), not STX.
 * - These events only appear after Stacks 4.0 / pox-5 activation.
 *
 * Returns `null` only for an event the codec knows but this switch doesn't map.
 */
export function makeSyntheticPox5Operation(
  poxEvent: Pox5Event,
  index: number,
  tx: DecodedStacksTransaction
): Operation | null {
  switch (poxEvent.name) {
    // ── STX staking ──────────────────────────────────────────────────────────
    case Pox5EventName.Stake:
      // A staker locks STX under a signer. `amount_ustx` is the locked amount.
      return {
        operation_identifier: { index: index + 1 },
        type: 'stake',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          amount_ustx: poxEvent.data.amount_ustx,
          signer: poxEvent.data.signer,
          num_cycles: parseInt(poxEvent.data.num_cycles),
          first_reward_cycle: parseInt(poxEvent.data.first_reward_cycle),
          unlock_burn_height: parseInt(poxEvent.data.unlock_burn_height),
          unlock_cycle: parseInt(poxEvent.data.unlock_cycle),
        },
      };

    case Pox5EventName.StakeUpdate:
      // Extend/increase an existing stake (and possibly rotate signer). `amount_ustx`
      // is the TOTAL locked amount after the update; `amount_increase` is the delta.
      return {
        operation_identifier: { index: index + 1 },
        type: 'stake_update',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          amount_ustx: poxEvent.data.amount_ustx,
          signer: poxEvent.data.signer,
          old_signer: poxEvent.data.old_signer,
          amount_increase: poxEvent.data.amount_increase,
          num_cycles: parseInt(poxEvent.data.num_cycles),
          cycles_to_extend: parseInt(poxEvent.data.cycles_to_extend),
          prev_unlock_height: parseInt(poxEvent.data.prev_unlock_height),
          unlock_burn_height: parseInt(poxEvent.data.unlock_burn_height),
          unlock_cycle: parseInt(poxEvent.data.unlock_cycle),
        },
      };

    case Pox5EventName.Unstake:
      // IMPORTANT: unstake does NOT unlock STX immediately. It sets the lock's unlock
      // height to the end of the current cycle; the STX stays locked until
      // `unlock_burn_height` is reached. For Rosetta balance reconciliation, do NOT
      // treat this as an immediate credit/unlock — the spendable balance is unchanged
      // until that burn height. (This mirrors the fix made in stacks-blockchain-api.)
      return {
        operation_identifier: { index: index + 1 },
        type: 'unstake',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          amount_ustx: poxEvent.data.amount_ustx,
          signer: poxEvent.data.signer,
          first_reward_cycle: parseInt(poxEvent.data.first_reward_cycle),
          unlock_cycle: parseInt(poxEvent.data.unlock_cycle),
          unlock_burn_height: parseInt(poxEvent.data.unlock_burn_height),
        },
      };

    // ── BTC/sBTC bond staking ────────────────────────────────────────────────
    case Pox5EventName.RegisterForBond:
      // A staker registers for a bond: locks `amount_ustx` STX and `sats_total`
      // BTC/sBTC (L1 lockup vs sBTC per `is_l1_lock`). The STX amount is the STX
      // operation; the BTC/sBTC side is a separate asset (see TODO below).
      return {
        operation_identifier: { index: index + 1 },
        type: 'register_for_bond',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          amount_ustx: poxEvent.data.amount_ustx,
          signer: poxEvent.data.signer,
          bond_index: parseInt(poxEvent.data.bond_index),
          sats_total: poxEvent.data.sats_total,
          is_l1_lock: poxEvent.data.is_l1_lock,
          first_reward_cycle: parseInt(poxEvent.data.first_reward_cycle),
          unlock_burn_height: parseInt(poxEvent.data.unlock_burn_height),
          unlock_cycle: parseInt(poxEvent.data.unlock_cycle),
          // TODO: represent the BTC/sBTC lockup (`sats_total`, `btc_lockup`) — this is
          //       a non-STX asset, so it needs a decision on whether/how Mesh models it.
        },
      };

    case Pox5EventName.UpdateBondRegistration:
      // Updating a bond registration can change the locked STX (`amount_ustx`) — the bond analog
      // of `stake-update`. `amount_sats` (the BTC/sBTC side) is surfaced in metadata only.
      return {
        operation_identifier: { index: index + 1 },
        type: 'update_bond_registration',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          amount_ustx: poxEvent.data.amount_ustx,
          signer: poxEvent.data.signer,
          old_signer: poxEvent.data.old_signer,
          bond_index: parseInt(poxEvent.data.bond_index),
          amount_sats: poxEvent.data.amount_sats,
          first_reward_cycle: parseInt(poxEvent.data.first_reward_cycle),
          num_cycles: parseInt(poxEvent.data.num_cycles),
          is_l1_lock: poxEvent.data.is_l1_lock,
        },
      };

    // ── Informational events (no STX balance movement) ───────────────────────
    // Surfaced so every pox-5 event is visible in a transaction. These carry no `amount`: rewards
    // are paid in sBTC (a separate asset), sBTC unstakes / L1 exits move BTC/sBTC, and the rest are
    // bond/signer administration or reward accounting. Each has its own typed metadata.
    case Pox5EventName.SetBondAdmin:
      return {
        operation_identifier: { index: index + 1 },
        type: 'set_bond_admin',
        status: tx.status,
        metadata: { old_admin: poxEvent.data.old_admin, new_admin: poxEvent.data.new_admin },
      };

    case Pox5EventName.SetupBond:
      return {
        operation_identifier: { index: index + 1 },
        type: 'setup_bond',
        status: tx.status,
        metadata: {
          bond_index: parseInt(poxEvent.data.bond_index),
          target_rate: parseInt(poxEvent.data.target_rate),
          stx_value_ratio: poxEvent.data.stx_value_ratio,
          min_ustx_ratio: poxEvent.data.min_ustx_ratio,
          early_unlock_bytes: poxEvent.data.early_unlock_bytes,
          first_reward_cycle: parseInt(poxEvent.data.first_reward_cycle),
          bond_start_height: parseInt(poxEvent.data.bond_start_height),
          unlock_cycle: parseInt(poxEvent.data.unlock_cycle),
          unlock_burn_height: parseInt(poxEvent.data.unlock_burn_height),
        },
      };

    case Pox5EventName.AddToAllowlist:
      return {
        operation_identifier: { index: index + 1 },
        type: 'add_to_allowlist',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          max_sats: poxEvent.data.max_sats,
          bond_index: parseInt(poxEvent.data.bond_index),
        },
      };

    case Pox5EventName.RegisterSigner:
      return {
        operation_identifier: { index: index + 1 },
        type: 'register_signer',
        status: tx.status,
        account: { address: poxEvent.data.signer },
        metadata: { signer_key: poxEvent.data.signer_key },
      };

    case Pox5EventName.AnnounceL1EarlyExit:
      return {
        operation_identifier: { index: index + 1 },
        type: 'announce_l1_early_exit',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          signer: poxEvent.data.signer,
          bond_index: parseInt(poxEvent.data.bond_index),
          amount_sats_released: poxEvent.data.amount_sats_released,
        },
      };

    case Pox5EventName.UnstakeSbtc:
      return {
        operation_identifier: { index: index + 1 },
        type: 'unstake_sbtc',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          signer: poxEvent.data.signer,
          bond_index: parseInt(poxEvent.data.bond_index),
          amount_withdrawn_sats: poxEvent.data.amount_withdrawn_sats,
          new_amount_sats: poxEvent.data.new_amount_sats,
        },
      };

    case Pox5EventName.CalculateRewards:
      return {
        operation_identifier: { index: index + 1 },
        type: 'calculate_rewards',
        status: tx.status,
        metadata: {
          bond_periods: poxEvent.data.bond_periods,
          calculation_height: parseInt(poxEvent.data.calculation_height),
          gross_accrued_rewards: poxEvent.data.gross_accrued_rewards,
          total_bond_rewards: poxEvent.data.total_bond_rewards,
          reserve_deposit: poxEvent.data.reserve_deposit,
          reserve_balance: poxEvent.data.reserve_balance,
          stx_cycle: parseInt(poxEvent.data.stx_cycle),
          total_stx_staker_rewards: poxEvent.data.total_stx_staker_rewards,
          cycle_staked_ustx: poxEvent.data.cycle_staked_ustx,
          accrued_rewards_per_ustx: poxEvent.data.accrued_rewards_per_ustx,
          cumulative_rewards_per_ustx: poxEvent.data.cumulative_rewards_per_ustx,
        },
      };

    case Pox5EventName.BondDistribution:
      return {
        operation_identifier: { index: index + 1 },
        type: 'bond_distribution',
        status: tx.status,
        metadata: {
          bond_index: parseInt(poxEvent.data.bond_index),
          target_yield: poxEvent.data.target_yield,
          bond_rewards: poxEvent.data.bond_rewards,
          bond_staked_sats: poxEvent.data.bond_staked_sats,
          accrued_rewards_per_sat: poxEvent.data.accrued_rewards_per_sat,
          cumulative_rewards_per_sat: poxEvent.data.cumulative_rewards_per_sat,
        },
      };

    case Pox5EventName.ClaimRewards:
      return {
        operation_identifier: { index: index + 1 },
        type: 'claim_rewards',
        status: tx.status,
        account: { address: poxEvent.data.signer_manager },
        metadata: {
          reward_cycle: parseInt(poxEvent.data.reward_cycle),
          stx_rewards: poxEvent.data.stx_rewards,
          bond_rewards: poxEvent.data.bond_rewards.map(r => ({
            bond_index: parseInt(r.bond_index),
            earned: r.earned,
            rewards_per_token: r.rewards_per_token,
          })),
          bond_totals: poxEvent.data.bond_totals,
          total_rewards: poxEvent.data.total_rewards,
        },
      };

    case Pox5EventName.ClaimStakerRewardsForSigner:
      return {
        operation_identifier: { index: index + 1 },
        type: 'claim_staker_rewards_for_signer',
        status: tx.status,
        account: { address: poxEvent.data.staker },
        metadata: {
          signer_manager: poxEvent.data.signer_manager,
          reward_cycle: parseInt(poxEvent.data.reward_cycle),
          bond_index: poxEvent.data.bond_index !== null ? parseInt(poxEvent.data.bond_index) : null,
          rewards_claimed: poxEvent.data.rewards_claimed,
        },
      };

    case Pox5EventName.GrantSignerKey:
      return {
        operation_identifier: { index: index + 1 },
        type: 'grant_signer_key',
        status: tx.status,
        account: { address: poxEvent.data.signer_manager },
        metadata: { signer_key: poxEvent.data.signer_key, auth_id: poxEvent.data.auth_id },
      };

    case Pox5EventName.RevokeSignerGrant:
      return {
        operation_identifier: { index: index + 1 },
        type: 'revoke_signer_grant',
        status: tx.status,
        account: { address: poxEvent.data.signer_manager },
        metadata: { signer_key: poxEvent.data.signer_key },
      };

    case Pox5EventName.AllowContractCaller:
      return {
        operation_identifier: { index: index + 1 },
        type: 'allow_contract_caller',
        status: tx.status,
        account: { address: poxEvent.data.sender },
        metadata: {
          contract_caller: poxEvent.data.contract_caller,
          until_burn_ht:
            poxEvent.data.until_burn_ht !== null ? parseInt(poxEvent.data.until_burn_ht) : null,
        },
      };

    case Pox5EventName.DisallowContractCaller:
      return {
        operation_identifier: { index: index + 1 },
        type: 'disallow_contract_caller',
        status: tx.status,
        account: { address: poxEvent.data.sender },
        metadata: { contract_caller: poxEvent.data.contract_caller },
      };

    default:
      // A pox-5 event the codec knows but this switch doesn't map yet — surface it for visibility.
      logger.debug(
        { event: (poxEvent as Pox5Event).name },
        'Unhandled pox-5 event; no operation emitted'
      );
      return null;
  }
}
