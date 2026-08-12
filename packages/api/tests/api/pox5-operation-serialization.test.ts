import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { OperationSchema } from '@stacks/mesh-schemas';

// A pox-5 operation with nested metadata (claim_rewards has a nested object + array). This verifies
// that its typed metadata actually round-trips through the fastify response serializer
// (fast-json-stringify), i.e. the events really do display with all their fields.
describe('pox-5 operation serialization', () => {
  test('emits the full metadata (incl. nested object + array) through the response schema', async () => {
    const fastify = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    fastify.post(
      '/op',
      { schema: { response: { 200: Type.Object({ operation: OperationSchema }) } } },
      async () => ({
        operation: {
          operation_identifier: { index: 1 },
          status: 'success',
          type: 'claim_rewards' as const,
          account: { address: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7' },
          metadata: {
            reward_cycle: 8,
            bond_totals: '5',
            total_rewards: '1234',
            stx_rewards: { earned: '10', rewards_per_token: '2' },
            bond_rewards: [{ bond_index: 0, earned: '5', rewards_per_token: '1' }],
          },
        },
      })
    );

    const res = await fastify.inject({ url: '/op', method: 'POST', payload: {} });
    assert.equal(res.statusCode, 200);
    const { operation } = JSON.parse(res.body);
    assert.equal(operation.type, 'claim_rewards');
    // Flat, nested-object, and nested-array metadata all survive serialization.
    assert.equal(operation.metadata.reward_cycle, 8);
    assert.deepEqual(operation.metadata.stx_rewards, { earned: '10', rewards_per_token: '2' });
    assert.deepEqual(operation.metadata.bond_rewards, [
      { bond_index: 0, earned: '5', rewards_per_token: '1' },
    ]);
    await fastify.close();
  });
});
