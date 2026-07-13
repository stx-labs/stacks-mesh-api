import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pox5EventName, type Pox5Event } from '@stacks/codec';
import { makeSyntheticPox5Operation } from '../../src/serializers/pox5-operations.js';
import { makeSyntheticPoxOperation } from '../../src/serializers/pox-operations.js';
import type { DecodedStacksTransaction } from '../../src/serializers/transactions.js';

// The pox-5 operation serializers are pure functions over a decoded event, so we
// unit-test them directly with constructed `Pox5Event` fixtures (pox-5 isn't
// activated on-chain, so there are no real block-replay fixtures to drive an
// integration test yet). Only `tx.status` is read from the transaction.
const tx = { status: 'success' } as unknown as DecodedStacksTransaction;

const SIGNER = 'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335.signer-manager';
const OLD_SIGNER = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.signer-manager';
const STAKER = 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7';
const STX = { symbol: 'STX', decimals: 6 };

describe('synthetic pox-5 operations', () => {
  test('stake → locks STX under a signer', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.Stake,
      data: {
        signer: SIGNER,
        staker: STAKER,
        amount_ustx: '5000000',
        num_cycles: '6',
        first_reward_cycle: '8',
        unlock_burn_height: '10000',
        unlock_cycle: '20',
      },
    };
    assert.deepStrictEqual(makeSyntheticPox5Operation(event, 0, tx), {
      operation_identifier: { index: 1 },
      type: 'stake',
      status: 'success',
      account: { address: STAKER },
      amount: { value: '5000000', currency: STX },
      metadata: {
        signer: SIGNER,
        num_cycles: 6,
        first_reward_cycle: 8,
        unlock_burn_height: 10000,
        unlock_cycle: 20,
      },
    });
  });

  test('stake-update → total locked amount plus the increase/extension', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.StakeUpdate,
      data: {
        unlock_burn_height: '12000',
        staker: STAKER,
        signer: SIGNER,
        old_signer: OLD_SIGNER,
        prev_unlock_height: '10000',
        unlock_cycle: '24',
        num_cycles: '8',
        amount_ustx: '7000000',
        amount_increase: '2000000',
        cycles_to_extend: '2',
      },
    };
    assert.deepStrictEqual(makeSyntheticPox5Operation(event, 2, tx), {
      operation_identifier: { index: 3 },
      type: 'stake_update',
      status: 'success',
      account: { address: STAKER },
      amount: { value: '7000000', currency: STX },
      metadata: {
        signer: SIGNER,
        old_signer: OLD_SIGNER,
        amount_increase: '2000000',
        num_cycles: 8,
        cycles_to_extend: 2,
        prev_unlock_height: 10000,
        unlock_burn_height: 12000,
        unlock_cycle: 24,
      },
    });
  });

  test('unstake → does NOT unlock immediately; carries the cycle-end unlock height', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.Unstake,
      data: {
        staker: STAKER,
        signer: SIGNER,
        amount_ustx: '5000000',
        first_reward_cycle: '8',
        unlock_cycle: '20',
        unlock_burn_height: '10000',
      },
    };
    const op = makeSyntheticPox5Operation(event, 0, tx);
    assert.deepStrictEqual(op, {
      operation_identifier: { index: 1 },
      type: 'unstake',
      status: 'success',
      account: { address: STAKER },
      amount: { value: '5000000', currency: STX },
      metadata: {
        signer: SIGNER,
        first_reward_cycle: 8,
        unlock_cycle: 20,
        // The STX stays locked until this burn height (unstake defers the unlock to
        // the end of the cycle) — consumers must not treat unstake as an immediate credit.
        unlock_burn_height: 10000,
      },
    });
  });

  test('register-for-bond → STX lock, with BTC/sBTC bond in metadata', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.RegisterForBond,
      data: {
        signer: SIGNER,
        staker: STAKER,
        amount_ustx: '10000000',
        sats_total: '1000',
        bond_index: '0',
        first_reward_cycle: '8',
        unlock_burn_height: '10000',
        unlock_cycle: '20',
        is_l1_lock: false,
        btc_lockup: { type: 'l2', txs: null },
      },
    };
    assert.deepStrictEqual(makeSyntheticPox5Operation(event, 0, tx), {
      operation_identifier: { index: 1 },
      type: 'register_for_bond',
      status: 'success',
      account: { address: STAKER },
      amount: { value: '10000000', currency: STX },
      metadata: {
        signer: SIGNER,
        bond_index: 0,
        sats_total: '1000',
        is_l1_lock: false,
        first_reward_cycle: 8,
        unlock_burn_height: 10000,
        unlock_cycle: 20,
      },
    });
  });

  test('reward claims map to no STX operation (rewards are sBTC)', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.ClaimStakerRewardsForSigner,
      data: {
        signer_manager: SIGNER,
        staker: STAKER,
        reward_cycle: '8',
        bond_index: null,
        rewards_claimed: '1234',
      },
    };
    assert.strictEqual(makeSyntheticPox5Operation(event, 0, tx), null);
  });

  test('non-balance admin events map to no operation', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.RegisterSigner,
      data: { signer: SIGNER, signer_key: '0x' + '02'.repeat(33) },
    };
    assert.strictEqual(makeSyntheticPox5Operation(event, 0, tx), null);
  });

  test('dispatcher routes pox_version=pox5 events to the pox-5 serializer', () => {
    const event: Pox5Event = {
      pox_version: 'pox5',
      name: Pox5EventName.Stake,
      data: {
        signer: SIGNER,
        staker: STAKER,
        amount_ustx: '5000000',
        num_cycles: '6',
        first_reward_cycle: '8',
        unlock_burn_height: '10000',
        unlock_cycle: '20',
      },
    };
    // makeSyntheticPoxOperation is the shared entry point; it must delegate pox-5
    // events (discriminated by `pox_version`) to makeSyntheticPox5Operation.
    assert.deepStrictEqual(
      makeSyntheticPoxOperation(event, 0, tx),
      makeSyntheticPox5Operation(event, 0, tx)
    );
  });
});
