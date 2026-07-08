import { Operation } from '@stacks/mesh-schemas';
// NOTE: the pox event enums/types are NAMED exports of @stacks/codec. They are NOT
// on the default export object, so `codec.Pox5EventName` is `undefined` at runtime —
// always import them by name.
import { Pox5EventName, type Pox5Event } from '@stacks/codec';
import { DecodedStacksTransaction, makeStxCurrency } from './transactions.js';

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
 * Key differences from pox-4 (`makeSyntheticPoxOperation`):
 * - pox-5 events have NO top-level `locked` / `balance` / `burnchain_unlock_height`
 *   envelope — everything is inside `data`. Post-event spendable balance must be
 *   read from the node (`/v2/accounts/{principal}`), not from the event.
 * - Rewards are paid in **sBTC** (a SIP-010 asset), not STX — see the reward events.
 * - These events only appear after Stacks 4.0 / pox-5 activation.
 *
 * Returns `null` for events that do not correspond to a balance-affecting STX
 * operation (signer/allowlist/bond-admin/reward-calculation bookkeeping).
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
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
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
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
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
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
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
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
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

    // ── Rewards (paid in sBTC) ───────────────────────────────────────────────
    case Pox5EventName.ClaimRewards:
    case Pox5EventName.ClaimStakerRewardsForSigner:
      // TODO: rewards are paid in sBTC (a SIP-010 token), not STX. Decide whether Mesh
      //       represents these at all and, if so, under what currency/asset. Left
      //       unhandled for now so we don't emit an incorrect STX operation.
      return null;

    // ── Bond/signer administration & bookkeeping (no STX balance effect) ─────
    // SetBondAdmin, SetupBond, AddToAllowlist, UpdateBondRegistration, RegisterSigner,
    // GrantSignerKey, RevokeSignerGrant, AllowContractCaller, DisallowContractCaller,
    // AnnounceL1EarlyExit, UnstakeSbtc, CalculateRewards, BondDistribution.
    // TODO: scaffold any of these that should surface as operations/metadata.
    default:
      return null;
  }
}
