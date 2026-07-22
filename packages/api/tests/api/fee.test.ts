import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PostConditionAuthFlag, type DecodedTxResult } from '@stacks/codec';
import { getDeclaredTxFee } from '../../src/serializers/transactions.js';

// Only `auth` is read by getDeclaredTxFee, so we construct minimal fixtures.
function txWithAuth(auth: unknown): DecodedTxResult {
  return { auth } as unknown as DecodedTxResult;
}

describe('getDeclaredTxFee', () => {
  test('reads the origin condition fee for a standard transaction', () => {
    const tx = txWithAuth({
      type_id: PostConditionAuthFlag.Standard,
      origin_condition: { tx_fee: '300' },
    });
    assert.equal(getDeclaredTxFee(tx).toString(), '300');
  });

  test('reads the sponsor condition fee for a sponsored transaction (sponsor pays)', () => {
    const tx = txWithAuth({
      type_id: PostConditionAuthFlag.Sponsored,
      origin_condition: { tx_fee: '0' },
      sponsor_condition: { tx_fee: '500' },
    });
    assert.equal(getDeclaredTxFee(tx).toString(), '500');
  });

  test('preserves u64 fees beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    const u64Max = '18446744073709551615';
    const tx = txWithAuth({
      type_id: PostConditionAuthFlag.Standard,
      origin_condition: { tx_fee: u64Max },
    });
    assert.equal(getDeclaredTxFee(tx).toString(), u64Max);
    // Sanity check: a plain JS number would have corrupted this value.
    assert.notEqual(Number(u64Max).toString(), u64Max);
  });
});
