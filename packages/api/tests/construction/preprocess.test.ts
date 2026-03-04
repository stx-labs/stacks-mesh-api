import * as assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  API_PORT,
  type DockerResources,
  post,
  NETWORK_IDENTIFIER,
  SENDER_ADDRESS,
  RECIPIENT_ADDRESS,
} from './helpers.js';

describe('/construction/preprocess', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;
  let senderAddress = SENDER_ADDRESS;
  let recipientAddress = RECIPIENT_ADDRESS;

  before(
    async () => {
      dockerResources = await setupDockerServices();
      fastify = await buildTestServer();
      await fastify.listen({ host: '0.0.0.0', port: API_PORT });
    },
    { timeout: 120_000 }
  );

  after(
    async () => {
      await fastify?.close();
      await teardownDockerServices(dockerResources);
    },
    { timeout: 30_000 }
  );

  describe('token_transfer', () => {
    test('accepts a valid transaction', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'hello' },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'hello' },
          },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.options);
      assert.equal(body.options.type, 'token_transfer');
      assert.equal(body.options.sender_address, senderAddress);
      assert.equal(body.options.recipient_address, recipientAddress);
      assert.equal(body.options.amount, '1000000');
      assert.equal(body.options.memo, 'hello');
      assert.ok(body.required_public_keys);
      assert.equal(body.required_public_keys.length, 1);
      assert.equal(body.required_public_keys[0].address, senderAddress);
    });

    test('rejects when only one operation is provided', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /require two operations/);
    });

    test('rejects when a fee operation is provided', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'fee',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'hello' },
          },
          {
            operation_identifier: { index: 2 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'hello' },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Fee operation is not allowed/);
    });

    test('rejects when more than two operations are provided', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 2 },
            type: 'token_transfer',
            account: { address: 'SP000000000000000000002Q6VF78' },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Invalid operation count/);
    });

    test('rejects when no recipient is provided', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: 'SP000000000000000000002Q6VF78' },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /one negative and one positive/);
    });

    test('rejects when the amounts are different', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-500000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /require the same amount/);
    });

    test('rejects when the memos are different', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-500000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'hello' },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '500000', currency: { symbol: 'STX', decimals: 6 } },
            metadata: { memo: 'world' },
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /require the same memo/);
    });

    test('forwards max_fee and suggested_fee_multiplier', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-500', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '500', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
        max_fee: [{ value: '10000', currency: { symbol: 'STX', decimals: 6 } }],
        suggested_fee_multiplier: 1.5,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.options.max_fee, '10000');
      assert.equal(body.options.suggested_fee_multiplier, 1.5);
    });
  });

  describe('contract_call', () => {
    test('accepts a valid transaction', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'contract_call',
            account: { address: senderAddress },
            metadata: {
              contract_identifier: 'SP000000000000000000002Q6VF78.token_transfer',
              function_name: 'transfer',
              args: ['0x1000000'],
            },
          },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.options);
      assert.equal(body.options.type, 'contract_call');
      assert.equal(body.options.sender_address, senderAddress);
      assert.equal(
        body.options.contract_identifier,
        'SP000000000000000000002Q6VF78.token_transfer'
      );
      assert.equal(body.options.function_name, 'transfer');
      assert.deepEqual(body.options.args, ['0x1000000']);
    });

    test('forwards max_fee and suggested_fee_multiplier', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'contract_call',
            account: { address: senderAddress },
            metadata: {
              contract_identifier: 'SP000000000000000000002Q6VF78.token_transfer',
              function_name: 'transfer',
              args: ['0x1000000'],
            },
          },
        ],
        max_fee: [{ value: '10000', currency: { symbol: 'STX', decimals: 6 } }],
        suggested_fee_multiplier: 1.5,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.options.max_fee, '10000');
      assert.equal(body.options.suggested_fee_multiplier, 1.5);
    });
  });

  describe('contract_deploy', () => {
    test('accepts a valid transaction', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'contract_deploy',
            account: { address: senderAddress },
            metadata: {
              contract_name: 'hello-world',
              clarity_version: 3,
              source_code: 'hello world',
            },
          },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.options);
      assert.equal(body.options.type, 'contract_deploy');
      assert.equal(body.options.sender_address, senderAddress);
      assert.equal(body.options.contract_name, 'hello-world');
      assert.equal(body.options.clarity_version, 3);
      assert.equal(body.options.source_code, 'hello world');
    });

    test('forwards max_fee and suggested_fee_multiplier', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'contract_deploy',
            account: { address: senderAddress },
            metadata: {
              contract_name: 'hello-world',
              clarity_version: 3,
              source_code: 'hello world',
            },
          },
        ],
        max_fee: [{ value: '10000', currency: { symbol: 'STX', decimals: 6 } }],
        suggested_fee_multiplier: 1.5,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.options.max_fee, '10000');
      assert.equal(body.options.suggested_fee_multiplier, 1.5);
    });
  });
});
