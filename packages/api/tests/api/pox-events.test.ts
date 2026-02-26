import { afterEach, before, beforeEach, describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ApiConfig, buildApiServer } from '../../src/api';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { FastifyInstance } from 'fastify';
import { loadFixture, makeTestApiConfig } from './helpers';

describe('synthetic pox events', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;
  let config: ApiConfig;

  before(() => {
    config = makeTestApiConfig();
    config.contractAbiCache['cache'].set(
      'SP001SFSMC2ZY76PD4M68P3WGX154XCH7NE3TYMX.pox4-pools',
      loadFixture('contract-interfaces/pox4-pools.json')
    );
    config.contractAbiCache['cache'].set(
      'SPMPMA1V6P430M8C91QS1G9XJ95S59JS1TZFZ4Q4.pox4-multi-pool-v1',
      loadFixture('contract-interfaces/pox4-multi-pool-v1.json')
    );
    config.contractAbiCache['cache'].set(
      'SP000000000000000000002Q6VF78.pox-4',
      loadFixture('contract-interfaces/pox-4.json')
    );
    config.contractAbiCache['cache'].set(
      'SP249RRK1HD531X0ZSMWYKKP4T94YBQT1NSYVFWPQ.contributor',
      loadFixture('contract-interfaces/contributor.json')
    );
  });

  beforeEach(async () => {
    fastify = await buildApiServer(config);
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  test('delegate-stx', async () => {
    const blockId = 'b027a9b07584e644aa057763bc8718a74bd1764192ae2b6079470e4e5da4826e';
    const txId = 'e11bd918dd5d78c8a64a5fde6bf7e76deeac53d9de8b09e396100801ce7e9da2';
    const fixture = loadFixture('blocks/delegate-stx.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);

    const delegateStx = json.transaction.operations[5];
    assert.strictEqual(delegateStx.type, 'delegate_stx');
    assert.strictEqual(delegateStx.account.address, 'SP3KMYS5X3XJ1K9H7J39J1ZZYRGRM8VFEXG46W1V6');
    assert.strictEqual(delegateStx.amount.value, '3049000000');
    assert.strictEqual(delegateStx.amount.currency.decimals, 6);
    assert.strictEqual(delegateStx.amount.currency.symbol, 'STX');
    assert.strictEqual(delegateStx.metadata.locked, '549000000');
    assert.strictEqual(delegateStx.metadata.balance, '2554498546');
    assert.strictEqual(delegateStx.metadata.burnchain_unlock_height, 939050);
    assert.strictEqual(
      delegateStx.metadata.delegate_to,
      'SPXVRSEH2BKSXAEJ00F1BY562P45D5ERPSKR4Q33'
    );
    assert.strictEqual(delegateStx.metadata.unlock_burn_height, null);
    assert.strictEqual(delegateStx.metadata.start_cycle_id, 130);
    assert.strictEqual(delegateStx.metadata.end_cycle_id, null);
  });

  test('revoke-delegate-stx', async () => {
    const blockId = 'b027a9b07584e644aa057763bc8718a74bd1764192ae2b6079470e4e5da4826e';
    const txId = 'e11bd918dd5d78c8a64a5fde6bf7e76deeac53d9de8b09e396100801ce7e9da2';
    const fixture = loadFixture('blocks/delegate-stx.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);

    const revokeDelegateStx = json.transaction.operations[3];
    assert.strictEqual(revokeDelegateStx.type, 'revoke_delegate_stx');
    assert.strictEqual(
      revokeDelegateStx.account.address,
      'SP3KMYS5X3XJ1K9H7J39J1ZZYRGRM8VFEXG46W1V6'
    );
    assert.strictEqual(revokeDelegateStx.metadata.locked, '549000000');
    assert.strictEqual(revokeDelegateStx.metadata.balance, '2554498546');
    assert.strictEqual(revokeDelegateStx.metadata.burnchain_unlock_height, 939050);
    assert.strictEqual(
      revokeDelegateStx.metadata.delegate_to,
      'SPXVRSEH2BKSXAEJ00F1BY562P45D5ERPSKR4Q33'
    );
    assert.strictEqual(revokeDelegateStx.metadata.start_cycle_id, 130);
    assert.strictEqual(revokeDelegateStx.metadata.end_cycle_id, null);
  });

  test('delegate-stack-increase', async () => {
    const blockId = 'e5e7b517b2e47b7c537961ded3dce52376659699a29a83f6b908d5e4574cd485';
    const txId = '8b86b9af6b46a2f28e138b4ee718294ea5b7fce6b655193d295d89cc9a146b5d';
    const fixture = loadFixture('blocks/delegate-stack-increase.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);
    assert.strictEqual(json.transaction.operations.length, 12);

    const delegateStackIncrease = json.transaction.operations[10];
    assert.strictEqual(delegateStackIncrease.type, 'delegate_stack_increase');
    assert.strictEqual(
      delegateStackIncrease.account.address,
      'SPYEMA86Q731HX4ND3HFSQR9X08QJ4MVHK303S47'
    );
    assert.strictEqual(delegateStackIncrease.amount.value, '2349804');
    assert.strictEqual(delegateStackIncrease.amount.currency.decimals, 6);
    assert.strictEqual(delegateStackIncrease.amount.currency.symbol, 'STX');
    assert.strictEqual(delegateStackIncrease.metadata.locked, '333349804');
    assert.strictEqual(delegateStackIncrease.metadata.balance, '1000000');
    assert.strictEqual(delegateStackIncrease.metadata.burnchain_unlock_height, 941150);
    assert.strictEqual(
      delegateStackIncrease.metadata.delegator,
      'SPMPMA1V6P430M8C91QS1G9XJ95S59JS1TZFZ4Q4.pox4-multi-pool-v1'
    );
    assert.strictEqual(delegateStackIncrease.metadata.start_cycle_id, 130);
    assert.strictEqual(delegateStackIncrease.metadata.end_cycle_id, 131);
  });

  test('stack-aggregation-increase', async () => {
    const blockId = 'c5b447181887732b77bd6fdcf110e237bccfa6bf4a38f6a9ef477158d9f45694';
    const txId = 'b7af9035dfdf514e2a7f39058e9a922c1a29aa1541cd2b179ba859b7087bb2d1';
    const fixture = loadFixture('blocks/stack-aggregation-increase.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);

    const stackAggregationIncrease = json.transaction.operations[3];
    assert.strictEqual(stackAggregationIncrease.type, 'stack_aggregation_increase');
    assert.strictEqual(stackAggregationIncrease.account.address, 'SP37NDP02F9Q8Q3RYKRNYN1QNP5N2RDQYM6R9Z4PK');
    assert.strictEqual(stackAggregationIncrease.amount.value, '25528422772');
    assert.strictEqual(stackAggregationIncrease.amount.currency.decimals, 6);
    assert.strictEqual(stackAggregationIncrease.amount.currency.symbol, 'STX');
    assert.strictEqual(stackAggregationIncrease.metadata.locked, '0');
    assert.strictEqual(stackAggregationIncrease.metadata.balance, '212403384');
    assert.strictEqual(stackAggregationIncrease.metadata.burnchain_unlock_height, 0);
    assert.strictEqual(stackAggregationIncrease.metadata.reward_cycle, 130);
    assert.strictEqual(stackAggregationIncrease.metadata.start_cycle_id, 130);
    assert.strictEqual(stackAggregationIncrease.metadata.end_cycle_id, 131);
  });

  test('stack-aggregation-commit-indexed', async () => {
    const blockId = '65012a0b35118450298db4aff4a1d1dbdc6869793e340e74e00eeb42c542ee2f';
    const txId = 'f4bcc14f5a6639e7078a9038c96e3b6b67b300d2615c7a32ea49ddd1d090d5cd';
    const fixture = loadFixture('blocks/stack-aggregation-commit-indexed.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);

    const stackAggregationCommitIndexed = json.transaction.operations[3];
    assert.strictEqual(stackAggregationCommitIndexed.type, 'stack_aggregation_commit_indexed');
    assert.strictEqual(stackAggregationCommitIndexed.account.address, 'SP249RRK1HD531X0ZSMWYKKP4T94YBQT1NSYVFWPQ.contributor');
    assert.strictEqual(stackAggregationCommitIndexed.amount.value, '74989152876659');
    assert.strictEqual(stackAggregationCommitIndexed.amount.currency.decimals, 6);
    assert.strictEqual(stackAggregationCommitIndexed.amount.currency.symbol, 'STX');
    assert.strictEqual(stackAggregationCommitIndexed.metadata.locked, '0');
    assert.strictEqual(stackAggregationCommitIndexed.metadata.balance, '0');
    assert.strictEqual(stackAggregationCommitIndexed.metadata.burnchain_unlock_height, 0);
    assert.strictEqual(stackAggregationCommitIndexed.metadata.reward_cycle, 130);
    assert.strictEqual(stackAggregationCommitIndexed.metadata.signer_key, '0x02844807121921880119fe05ae47fccb4945a4bb2f840fe7de66e6f32640bc8169');
    assert.strictEqual(stackAggregationCommitIndexed.metadata.start_cycle_id, 130);
    assert.strictEqual(stackAggregationCommitIndexed.metadata.end_cycle_id, 131);
  });

  test('delegate-stack-extend', async () => {
    const blockId = '65012a0b35118450298db4aff4a1d1dbdc6869793e340e74e00eeb42c542ee2f';
    const txId = '402887472091cd096e7652730c7a9559a0779b3d66abafd914637325eb1f9203';
    const fixture = loadFixture('blocks/stack-aggregation-commit-indexed.json');
    const mockPool = mockAgent.get('http://test.stacks.node:20444');
    mockPool
      .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
      .reply(200, fixture, { headers: { 'content-type': 'application/json' } });

    const response = await fastify.inject({
      url: '/block/transaction',
      method: 'POST',
      payload: JSON.stringify({
        network_identifier: { blockchain: 'stacks', network: 'mainnet' },
        block_identifier: { hash: `0x${blockId}` },
        transaction_identifier: { hash: `0x${txId}` },
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(response.statusCode, 200);
    const json = JSON.parse(response.body);

    const delegateStackExtend = json.transaction.operations[3];
    assert.strictEqual(delegateStackExtend.type, 'delegate_stack_extend');
    assert.strictEqual(delegateStackExtend.account.address, 'SPRQZTY6CHRPJK5HJR6T9783WFNYSPCG04PMFHZZ');
    assert.strictEqual(delegateStackExtend.metadata.locked, '982961');
    assert.strictEqual(delegateStackExtend.metadata.balance, '0');
    assert.strictEqual(delegateStackExtend.metadata.burnchain_unlock_height, 941150);
    assert.strictEqual(delegateStackExtend.metadata.extend_count, 1);
    assert.strictEqual(delegateStackExtend.metadata.delegator, 'SP249RRK1HD531X0ZSMWYKKP4T94YBQT1NSYVFWPQ.contributor');
    assert.strictEqual(delegateStackExtend.metadata.start_cycle_id, 130);
    assert.strictEqual(delegateStackExtend.metadata.end_cycle_id, 131);
  });
});
