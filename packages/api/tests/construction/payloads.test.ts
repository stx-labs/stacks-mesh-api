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
  SENDER_PUBLIC_KEY,
  RECIPIENT_PUBLIC_KEY,
  COUNTER_CONTRACT_SOURCE_CODE,
} from './helpers.js';

describe('/construction/payloads', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;
  let senderAddress = SENDER_ADDRESS;
  let recipientAddress = RECIPIENT_ADDRESS;
  let senderPublicKey = `0x${SENDER_PUBLIC_KEY}`;
  let recipientPublicKey = `0x${RECIPIENT_PUBLIC_KEY}`;

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
    test('builds unsigned transaction and returns signing payload', async () => {
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
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
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          amount: '1000000',
          memo: 'hello',
          type: 'token_transfer',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Should return unsigned transaction hex
      assert.ok(body.unsigned_transaction);
      assert.ok(body.unsigned_transaction.length > 0);

      // Should return exactly one signing payload
      assert.ok(body.payloads);
      assert.equal(body.payloads.length, 1);
      assert.equal(body.payloads[0].account_identifier.address, senderAddress);
      assert.equal(body.payloads[0].address, senderAddress);
      assert.equal(body.payloads[0].signature_type, 'ecdsa_recovery');
      assert.ok(body.payloads[0].hex_bytes);
    });

    test('rejects operations without a fee', async () => {
      const operations = [
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
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          amount: '1000000',
          memo: 'hello',
          type: 'token_transfer',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Fee operation is required/);
    });

    test('rejects when public key does not match sender address', async () => {
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
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
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          amount: '1000000',
          memo: 'hello',
          type: 'token_transfer',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        // Provide a key that doesn't match senderAddress
        public_keys: [{ hex_bytes: recipientPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /public key does not match/);
    });

    test('rejects when the fee payer address does not match the sender address', async () => {
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: 'ST000000000000000000002Q6VF78' },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
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
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          amount: '1000000',
          memo: 'hello',
          type: 'token_transfer',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Fee payer address does not match/);
    });

    test('rejects when fee amount is not negative', async () => {
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '200', currency: { symbol: 'STX', decimals: 6 } },
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
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          amount: '1000000',
          memo: 'hello',
          type: 'token_transfer',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Fee amount must be negative/);
    });
  });

  describe('contract_call', () => {
    test('builds unsigned transaction and returns signing payload', async () => {
      const contractIdentifier = `${SENDER_ADDRESS}.hello`;
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
        },
        {
          operation_identifier: { index: 1 },
          type: 'contract_call',
          account: { address: senderAddress },
          metadata: {
            contract_identifier: contractIdentifier,
            function_name: 'hello',
            args: ['0x0701000000000000000000000069aa108e26'],
          },
        },
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          type: 'contract_call',
          contract_identifier: contractIdentifier,
          function_name: 'hello',
          args: ['0x0701000000000000000000000069aa108e26'],
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Should return unsigned transaction hex
      assert.ok(body.unsigned_transaction);
      assert.ok(body.unsigned_transaction.length > 0);

      // Should return exactly one signing payload
      assert.ok(body.payloads);
      assert.equal(body.payloads.length, 1);
      assert.equal(body.payloads[0].account_identifier.address, senderAddress);
      assert.equal(body.payloads[0].address, senderAddress);
      assert.equal(body.payloads[0].signature_type, 'ecdsa_recovery');
      assert.ok(body.payloads[0].hex_bytes);
    });

    test('accepts metadata options with values in different order and undefined fields', async () => {
      const contractIdentifier = `${SENDER_ADDRESS}.hello`;
      const firstArg = '0x03';
      const secondArg = '0x04';
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
        },
        {
          operation_identifier: { index: 1 },
          type: 'contract_call',
          account: { address: senderAddress },
          metadata: {
            contract_identifier: contractIdentifier,
            function_name: 'hello',
            args: [firstArg, secondArg],
            memo: undefined,
          },
        },
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        // Alter property order to test unordered deep strict equality
        options: {
          args: [firstArg, secondArg],
          function_name: 'hello',
          contract_identifier: contractIdentifier,
          sender_address: senderAddress,
          type: 'contract_call',
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.unsigned_transaction);
      assert.ok(body.payloads);
      assert.equal(body.payloads.length, 1);
    });
  });

  describe('contract_deploy', () => {
    test('builds unsigned transaction and returns signing payload', async () => {
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: senderAddress },
          amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } },
        },
        {
          operation_identifier: { index: 1 },
          type: 'contract_deploy',
          account: { address: senderAddress },
          metadata: {
            contract_name: 'counter',
            source_code: COUNTER_CONTRACT_SOURCE_CODE,
            clarity_version: 1,
          },
        },
      ];
      const metadata = {
        sender_account_info: {
          nonce: 0,
          balance: '1000000',
        },
        options: {
          sender_address: senderAddress,
          type: 'contract_deploy',
          contract_name: 'counter',
          source_code: COUNTER_CONTRACT_SOURCE_CODE,
          clarity_version: 1,
        },
      };
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        metadata,
        public_keys: [{ hex_bytes: senderPublicKey, curve_type: 'secp256k1' }],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Should return unsigned transaction hex
      assert.ok(body.unsigned_transaction);
      assert.ok(body.unsigned_transaction.length > 0);

      // Should return exactly one signing payload
      assert.ok(body.payloads);
      assert.equal(body.payloads.length, 1);
      assert.equal(body.payloads[0].account_identifier.address, senderAddress);
      assert.equal(body.payloads[0].address, senderAddress);
      assert.equal(body.payloads[0].signature_type, 'ecdsa_recovery');
      assert.ok(body.payloads[0].hex_bytes);
    });
  });
});
