import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  PostConditionAssetInfoID,
  PostConditionFungibleConditionCodeID,
  PostConditionFungibleConditionCodeName,
  PostConditionModeID,
  PostConditionPoxConditionCodeID,
  PostConditionPoxConditionCodeName,
  PostConditionPrincipalTypeID,
  type TxPostCondition,
} from '@stacks/codec';
import { serializePostConditions } from '../../src/serializers/post-conditions.js';
import type { DecodedStacksTransaction } from '../../src/serializers/transactions.js';

// Covers the pox-5 post-condition variants added in codec 2.0 (Staking, Pox), and
// implicitly guards the named-enum import fix (the enums are undefined on the codec
// default export, so serializePostConditions would throw at runtime otherwise).
const ADDR = 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7';
const principal = { type_id: PostConditionPrincipalTypeID.Standard, address: ADDR };

function makeTx(postConditions: TxPostCondition[]): DecodedStacksTransaction {
  return {
    decodedTx: {
      post_conditions: postConditions,
      post_condition_mode: PostConditionModeID.Deny,
    },
  } as unknown as DecodedStacksTransaction;
}

describe('pox-5 post conditions', () => {
  test('staking post condition → STX-like (amount + fungible condition code)', () => {
    const pc: TxPostCondition = {
      asset_info_id: PostConditionAssetInfoID.Staking,
      principal,
      condition_code: PostConditionFungibleConditionCodeID.SentEq,
      condition_name: PostConditionFungibleConditionCodeName.SentEq,
      amount: '1000000',
    };
    assert.deepStrictEqual(serializePostConditions(makeTx([pc])), {
      mode: 'deny',
      post_conditions: [
        {
          type: 'staking',
          condition_code: 'sent_equal_to',
          amount: '1000000',
          principal: { type_id: 'principal_standard', address: ADDR },
        },
      ],
    });
  });

  test('pox post condition → condition code only, no amount', () => {
    const pc: TxPostCondition = {
      asset_info_id: PostConditionAssetInfoID.Pox,
      principal,
      condition_code: PostConditionPoxConditionCodeID.NotPerformed,
      condition_name: PostConditionPoxConditionCodeName.NotPerformed,
    };
    assert.deepStrictEqual(serializePostConditions(makeTx([pc])), {
      mode: 'deny',
      post_conditions: [
        {
          type: 'pox',
          condition_code: 'not_performed',
          principal: { type_id: 'principal_standard', address: ADDR },
        },
      ],
    });
  });
});
