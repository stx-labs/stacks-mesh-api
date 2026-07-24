import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  makeUnsignedSTXTokenTransfer,
  privateKeyToPublic,
  serializeTransaction,
} from '@stacks/transactions';
import { estimateTransactionFee, reorderSignatureToVrs } from '../../src/utils/construction.js';

describe('reorderSignatureToVrs', () => {
  test('moves the trailing recovery byte to the front ([R|S|V] -> [V|R|S])', () => {
    const r = 'aa'.repeat(32); // 64 hex
    const s = 'bb'.repeat(32); // 64 hex
    const v = '00'; // recovery id
    assert.equal(reorderSignatureToVrs(r + s + v), v + r + s);
  });

  test('matches the reporter example (v=00 stuck at the end -> front)', () => {
    const rs = '6c65a6'.padEnd(128, 'f'); // 128 hex chars standing in for R|S
    assert.equal(reorderSignatureToVrs(rs + '00'), '00' + rs);
  });

  test('preserves length', () => {
    const sig = '12'.repeat(65);
    assert.equal(reorderSignatureToVrs(sig).length, 130);
  });
});

describe('estimateTransactionFee', () => {
  test('estimates from the full serialized tx size at the given per-byte rate, with a floor', async () => {
    const publicKey = privateKeyToPublic(
      '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'
    );
    const tx = await makeUnsignedSTXTokenTransfer({
      recipient: 'ST000000000000000000002AMW42H',
      amount: 1,
      fee: 0,
      nonce: 0,
      publicKey,
    });
    const byteLength = serializeTransaction(tx).length / 2;
    const defaultFee = 200;

    // Default rate (1) uses the full tx size, floored at defaultFee.
    assert.equal(estimateTransactionFee(tx, defaultFee), Math.max(defaultFee, byteLength));
    // High rate: fee scales with the full tx byte length (well above the floor).
    assert.equal(estimateTransactionFee(tx, defaultFee, 10), Math.ceil(byteLength * 10));
    // Floor applies when rate*size would be below it.
    assert.equal(estimateTransactionFee(tx, defaultFee, 0.0001), defaultFee);
  });
});
