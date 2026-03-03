import * as assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  privateKeyToPublic,
  signWithKey,
} from '@stacks/transactions';

import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  API_PORT,
  type DockerResources,
} from './helpers.js';

// Funded accounts from the Docker image's genesis allocation (see config.toml [[ustx_balance]])
const SENDER_PRIVATE_KEY =
  'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
const SENDER_PUBLIC_KEY = privateKeyToPublic(SENDER_PRIVATE_KEY);

// A second funded account to use as recipient
const RECIPIENT_PRIVATE_KEY =
  '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
const RECIPIENT_PUBLIC_KEY = privateKeyToPublic(RECIPIENT_PRIVATE_KEY);

// Separate funded accounts for end-to-end tests (avoids nonce conflicts with unit tests)
const E2E_SENDER_PRIVATE_KEY =
  'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01';
const E2E_SENDER_PUBLIC_KEY = privateKeyToPublic(E2E_SENDER_PRIVATE_KEY);
const E2E_RECIPIENT_PRIVATE_KEY =
  'e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01';
const E2E_RECIPIENT_PUBLIC_KEY = privateKeyToPublic(E2E_RECIPIENT_PRIVATE_KEY);

const NETWORK_IDENTIFIER = { blockchain: 'stacks', network: 'testnet' };

/** POST helper for Mesh endpoints. */
async function post(fastify: FastifyInstance, url: string, payload: Record<string, unknown>) {
  return fastify.inject({
    method: 'POST',
    url,
    payload: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Waits until the sender's on-chain nonce advances past {@link previousNonce},
 * indicating the submitted transaction has been included in a block.
 */
async function waitForNonceAdvance(
  fastify: FastifyInstance,
  senderAddress: string,
  previousNonce: number,
  timeoutMs = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await post(fastify, '/account/balance', {
      network_identifier: NETWORK_IDENTIFIER,
      account_identifier: { address: senderAddress },
    });
    if (res.statusCode === 200) {
      const body = JSON.parse(res.body);
      if (body.metadata?.nonce > previousNonce) return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nonce for ${senderAddress} did not advance past ${previousNonce} within ${timeoutMs}ms`);
}

describe('Construction API', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;
  let senderAddress: string;
  let recipientAddress: string;
  let e2eSenderAddress: string;
  let e2eRecipientAddress: string;

  before(async () => {
    dockerResources = await setupDockerServices();
    fastify = await buildTestServer();
    await fastify.listen({ host: '0.0.0.0', port: API_PORT });

    // Derive addresses from our known keys (uses testnet network from the node)
    const [deriveRes, recipientRes, e2eSenderRes, e2eRecipientRes] = await Promise.all([
      post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      }),
      post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
      }),
      post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      }),
      post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: E2E_RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
      }),
    ]);
    senderAddress = JSON.parse(deriveRes.body).account_identifier.address;
    recipientAddress = JSON.parse(recipientRes.body).account_identifier.address;
    e2eSenderAddress = JSON.parse(e2eSenderRes.body).account_identifier.address;
    e2eRecipientAddress = JSON.parse(e2eRecipientRes.body).account_identifier.address;
  }, { timeout: 120_000 });

  after(async () => {
    await fastify?.close();
    await teardownDockerServices(dockerResources);
  }, { timeout: 30_000 });

  // ── /construction/derive ────────────────────────────────────────────────

  describe('/construction/derive', () => {
    test('derives a valid address from a secp256k1 public key', async () => {
      const res = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: {
          hex_bytes: SENDER_PUBLIC_KEY,
          curve_type: 'secp256k1',
        },
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.account_identifier.address);
      // Testnet addresses start with ST
      assert.match(body.account_identifier.address, /^ST/);
    });

    test('derives a consistent address for the same public key', async () => {
      const res1 = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      const res2 = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      const addr1 = JSON.parse(res1.body).account_identifier.address;
      const addr2 = JSON.parse(res2.body).account_identifier.address;
      assert.equal(addr1, addr2);
    });

    test('derives different addresses for different public keys', async () => {
      const res1 = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      const res2 = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      const addr1 = JSON.parse(res1.body).account_identifier.address;
      const addr2 = JSON.parse(res2.body).account_identifier.address;
      assert.notEqual(addr1, addr2);
    });

    test('rejects unsupported curve types', async () => {
      const res = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: {
          hex_bytes: SENDER_PUBLIC_KEY,
          curve_type: 'edwards25519',
        },
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.ok(body.description.includes('Unsupported curve type'));
    });
  });

  // ── /construction/preprocess ────────────────────────────────────────────

  describe('/construction/preprocess', () => {
    test('extracts sender and recipient from transfer operations', async () => {
      const res = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'fee',
            account: { address: senderAddress },
            amount: { value: '-180', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 2 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.options);
      assert.ok(body.options.sender_addresses.includes(senderAddress));
      assert.ok(body.options.recipient_addresses.includes(recipientAddress));
      assert.equal(body.options.operation_count, 3);
      assert.ok(body.required_public_keys);
      assert.equal(body.required_public_keys.length, 1);
      assert.equal(body.required_public_keys[0].address, senderAddress);
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

  // ── /construction/metadata ──────────────────────────────────────────────

  describe('/construction/metadata', () => {
    test('returns account info, recent block hash, and suggested fee', async () => {
      const res = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: {
          sender_addresses: [senderAddress],
          recipient_addresses: [recipientAddress],
          operation_count: 3,
        },
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Metadata should contain account_info for sender
      assert.ok(body.metadata.account_info);
      assert.ok(body.metadata.account_info[senderAddress]);
      assert.ok(typeof body.metadata.account_info[senderAddress].nonce === 'number');
      assert.ok(typeof body.metadata.account_info[senderAddress].balance === 'string');

      // Recent block hash should be present
      assert.ok(body.metadata.recent_block_hash);

      // Suggested fee should be present
      assert.ok(body.suggested_fee);
      assert.ok(body.suggested_fee.length > 0);
      assert.ok(Number(body.suggested_fee[0].value) > 0);
      assert.deepEqual(body.suggested_fee[0].currency, {
        symbol: 'STX',
        decimals: 6,
      });
    });

    test('respects max_fee cap', async () => {
      const res = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: {
          sender_addresses: [senderAddress],
          recipient_addresses: [recipientAddress],
          operation_count: 3,
          max_fee: '100',
        },
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Number(body.suggested_fee[0].value) <= 100);
    });
  });

  // ── /construction/payloads ──────────────────────────────────────────────

  describe('/construction/payloads', () => {
    test('builds unsigned transaction and returns signing payload', async () => {
      // First get metadata
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: {
          sender_addresses: [senderAddress],
          recipient_addresses: [recipientAddress],
          operation_count: 3,
        },
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
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
            amount: { value: '-1000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 2 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
        metadata,
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Should return unsigned transaction hex
      assert.ok(body.unsigned_transaction);
      assert.ok(body.unsigned_transaction.length > 0);

      // Should return exactly one signing payload
      assert.ok(body.payloads);
      assert.equal(body.payloads.length, 1);
      assert.equal(body.payloads[0].address, senderAddress);
      assert.equal(body.payloads[0].signature_type, 'ecdsa_recovery');
      assert.ok(body.payloads[0].hex_bytes);
    });

    test('rejects operations without a sender', async () => {
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
        metadata: {},
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      assert.equal(res.statusCode, 500);
    });

    test('rejects when no matching public key is provided', async () => {
      const res = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          {
            operation_identifier: { index: 0 },
            type: 'token_transfer',
            account: { address: senderAddress },
            amount: { value: '-1000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 1 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
        metadata: {},
        // Provide a key that doesn't match senderAddress
        public_keys: [
          { hex_bytes: RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.ok(body.description.includes('No public key'));
    });
  });

  // ── /construction/combine ───────────────────────────────────────────────

  describe('/construction/combine', () => {
    test('combines unsigned transaction with a valid signature', async () => {
      // Build an unsigned transaction
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: {
          sender_addresses: [senderAddress],
          recipient_addresses: [recipientAddress],
          operation_count: 3,
        },
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
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
            amount: { value: '-1000', currency: { symbol: 'STX', decimals: 6 } },
          },
          {
            operation_identifier: { index: 2 },
            type: 'token_transfer',
            account: { address: recipientAddress },
            amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } },
          },
        ],
        metadata,
        public_keys: [
          { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
        ],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);
      const unsignedTx = payloadsBody.unsigned_transaction;
      const sighash = payloadsBody.payloads[0].hex_bytes;

      // Sign the sighash offline
      const signature = signWithKey(SENDER_PRIVATE_KEY, sighash);

      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: unsignedTx,
        signatures: [
          {
            signing_payload: {
              hex_bytes: sighash,
              address: senderAddress,
              signature_type: 'ecdsa_recovery',
            },
            public_key: {
              hex_bytes: SENDER_PUBLIC_KEY,
              curve_type: 'secp256k1',
            },
            signature_type: 'ecdsa_recovery',
            hex_bytes: signature,
          },
        ],
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.signed_transaction);
      assert.ok(body.signed_transaction.length >= unsignedTx.length);
    });

    test('rejects when no signatures are provided', async () => {
      // Build a minimal unsigned tx
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-1000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata: JSON.parse(metaRes.body).metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });

      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: JSON.parse(payloadsRes.body).unsigned_transaction,
        signatures: [],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.ok(body.description.includes('At least one signature'));
    });

    test('rejects a signature with invalid length', async () => {
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-1000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '1000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata: JSON.parse(metaRes.body).metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);

      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [
          {
            signing_payload: {
              hex_bytes: payloadsBody.payloads[0].hex_bytes,
              address: senderAddress,
              signature_type: 'ecdsa_recovery',
            },
            public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
            signature_type: 'ecdsa_recovery',
            hex_bytes: 'aabbccdd', // Too short
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.ok(body.description.includes('Invalid signature length'));
    });
  });

  // ── /construction/parse ─────────────────────────────────────────────────

  describe('/construction/parse', () => {
    /** Helper: build an unsigned tx and optionally sign it. */
    async function buildTransaction(sign: boolean) {
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-5000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '5000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);

      if (!sign) return payloadsBody.unsigned_transaction;

      const signature = signWithKey(
        SENDER_PRIVATE_KEY,
        payloadsBody.payloads[0].hex_bytes
      );
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [
          {
            signing_payload: {
              hex_bytes: payloadsBody.payloads[0].hex_bytes,
              address: senderAddress,
              signature_type: 'ecdsa_recovery',
            },
            public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
            signature_type: 'ecdsa_recovery',
            hex_bytes: signature,
          },
        ],
      });
      return JSON.parse(combineRes.body).signed_transaction;
    }

    test('parses an unsigned transaction into operations', async () => {
      const unsignedTx = await buildTransaction(false);
      const res = await post(fastify, '/construction/parse', {
        network_identifier: NETWORK_IDENTIFIER,
        signed: false,
        transaction: unsignedTx,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      // Should contain fee + sender transfer + recipient transfer operations
      assert.ok(body.operations.length >= 2);

      // Fee operation
      const feeOp = body.operations.find((op: { type: string }) => op.type === 'fee');
      assert.ok(feeOp);
      assert.equal(feeOp.amount.value, '-200');

      // Transfer operations
      const transferOps = body.operations.filter(
        (op: { type: string }) => op.type === 'token_transfer'
      );
      assert.equal(transferOps.length, 2);

      // Sender (negative) and recipient (positive)
      const senderOp = transferOps.find(
        (op: { amount: { value: string } }) => BigInt(op.amount.value) < 0n
      );
      const recipientOp = transferOps.find(
        (op: { amount: { value: string } }) => BigInt(op.amount.value) > 0n
      );
      assert.ok(senderOp);
      assert.ok(recipientOp);
      assert.equal(senderOp.amount.value, '-5000');
      assert.equal(recipientOp.amount.value, '5000');

      // Unsigned transaction should not have signers
      assert.ok(!body.account_identifier_signers);
    });

    test('parses a signed transaction and includes signers', async () => {
      const signedTx = await buildTransaction(true);
      const res = await post(fastify, '/construction/parse', {
        network_identifier: NETWORK_IDENTIFIER,
        signed: true,
        transaction: signedTx,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);

      assert.ok(body.operations.length >= 2);
      assert.ok(body.account_identifier_signers);
      assert.equal(body.account_identifier_signers.length, 1);
      assert.equal(body.account_identifier_signers[0].address, senderAddress);
    });
  });

  // ── /construction/hash ──────────────────────────────────────────────────

  describe('/construction/hash', () => {
    test('computes the transaction hash from a signed transaction', async () => {
      // Build a signed transaction
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-2000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '2000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);

      const signature = signWithKey(
        SENDER_PRIVATE_KEY,
        payloadsBody.payloads[0].hex_bytes
      );
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [
          {
            signing_payload: { hex_bytes: payloadsBody.payloads[0].hex_bytes, address: senderAddress, signature_type: 'ecdsa_recovery' },
            public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
            signature_type: 'ecdsa_recovery',
            hex_bytes: signature,
          },
        ],
      });
      const signedTx = JSON.parse(combineRes.body).signed_transaction;

      const res = await post(fastify, '/construction/hash', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.transaction_identifier.hash);
      // Txid should be a 0x-prefixed 64-char hex string
      assert.match(body.transaction_identifier.hash, /^0x[0-9a-f]{64}$/);
    });

    test('returns the same hash for the same signed transaction', async () => {
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-200', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-3000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '3000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);
      const signature = signWithKey(SENDER_PRIVATE_KEY, payloadsBody.payloads[0].hex_bytes);
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [{
          signing_payload: { hex_bytes: payloadsBody.payloads[0].hex_bytes, address: senderAddress, signature_type: 'ecdsa_recovery' },
          public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
          signature_type: 'ecdsa_recovery',
          hex_bytes: signature,
        }],
      });
      const signedTx = JSON.parse(combineRes.body).signed_transaction;

      const [res1, res2] = await Promise.all([
        post(fastify, '/construction/hash', { network_identifier: NETWORK_IDENTIFIER, signed_transaction: signedTx }),
        post(fastify, '/construction/hash', { network_identifier: NETWORK_IDENTIFIER, signed_transaction: signedTx }),
      ]);
      const hash1 = JSON.parse(res1.body).transaction_identifier.hash;
      const hash2 = JSON.parse(res2.body).transaction_identifier.hash;
      assert.equal(hash1, hash2);
    });
  });

  // ── /construction/submit ────────────────────────────────────────────────

  describe('/construction/submit', () => {
    test('broadcasts a signed transaction and returns a txid', { timeout: 30_000 }, async () => {
      // Build a signed transaction through the full flow
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [senderAddress], recipient_addresses: [recipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: senderAddress }, amount: { value: '-10000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: senderAddress }, amount: { value: '-100000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: recipientAddress }, amount: { value: '100000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata,
        public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);

      const signature = signWithKey(
        SENDER_PRIVATE_KEY,
        payloadsBody.payloads[0].hex_bytes
      );
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [{
          signing_payload: { hex_bytes: payloadsBody.payloads[0].hex_bytes, address: senderAddress, signature_type: 'ecdsa_recovery' },
          public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
          signature_type: 'ecdsa_recovery',
          hex_bytes: signature,
        }],
      });
      const signedTx = JSON.parse(combineRes.body).signed_transaction;

      // Get the expected txid
      const hashRes = await post(fastify, '/construction/hash', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      const expectedTxid = JSON.parse(hashRes.body).transaction_identifier.hash;

      // Submit the signed transaction
      const res = await post(fastify, '/construction/submit', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      assert.equal(res.statusCode, 200, `submit failed: ${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(body.transaction_identifier.hash);
      assert.match(body.transaction_identifier.hash, /^0x[0-9a-f]{64}$/);

      // The txid returned by submit should match the one from hash
      assert.equal(body.transaction_identifier.hash, expectedTxid);
    });
  });

  // ── Full end-to-end flow ────────────────────────────────────────────────

  describe('end-to-end: derive → preprocess → metadata → payloads → combine → parse → hash → submit', () => {
    test('completes a full STX transfer and confirms it on chain', { timeout: 120_000 }, async () => {
      // 1. Derive sender and recipient addresses (uses separate E2E accounts to avoid nonce conflicts)
      const deriveRes = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      assert.equal(deriveRes.statusCode, 200);
      const sender = JSON.parse(deriveRes.body).account_identifier.address;

      const deriveRecipientRes = await post(fastify, '/construction/derive', {
        network_identifier: NETWORK_IDENTIFIER,
        public_key: { hex_bytes: E2E_RECIPIENT_PUBLIC_KEY, curve_type: 'secp256k1' },
      });
      assert.equal(deriveRecipientRes.statusCode, 200);
      const recipient = JSON.parse(deriveRecipientRes.body).account_identifier.address;

      const transferAmount = '500000'; // 0.5 STX

      // 2. Preprocess
      const operations = [
        {
          operation_identifier: { index: 0 },
          type: 'token_transfer',
          account: { address: sender },
          amount: { value: `-${transferAmount}`, currency: { symbol: 'STX', decimals: 6 } },
        },
        {
          operation_identifier: { index: 1 },
          type: 'token_transfer',
          account: { address: recipient },
          amount: { value: transferAmount, currency: { symbol: 'STX', decimals: 6 } },
        },
      ];

      const preprocessRes = await post(fastify, '/construction/preprocess', {
        network_identifier: NETWORK_IDENTIFIER,
        operations,
        max_fee: [{ value: '50000', currency: { symbol: 'STX', decimals: 6 } }],
      });
      assert.equal(preprocessRes.statusCode, 200);
      const preprocessBody = JSON.parse(preprocessRes.body);
      assert.ok(preprocessBody.options);
      assert.ok(preprocessBody.required_public_keys);

      // 3. Metadata
      const metadataRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: preprocessBody.options,
        public_keys: [{ hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      assert.equal(metadataRes.statusCode, 200);
      const metadataBody = JSON.parse(metadataRes.body);
      const fee = metadataBody.suggested_fee[0].value;
      const senderNonce = metadataBody.metadata.account_info[sender]?.nonce ?? 0;

      // 4. Payloads — include fee as an operation
      const fullOperations = [
        {
          operation_identifier: { index: 0 },
          type: 'fee',
          account: { address: sender },
          amount: { value: `-${fee}`, currency: { symbol: 'STX', decimals: 6 } },
        },
        ...operations.map((op, i) => ({
          ...op,
          operation_identifier: { index: i + 1 },
        })),
      ];

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: fullOperations,
        metadata: metadataBody.metadata,
        public_keys: [{ hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      assert.equal(payloadsRes.statusCode, 200);
      const payloadsBody = JSON.parse(payloadsRes.body);
      assert.ok(payloadsBody.unsigned_transaction);
      assert.equal(payloadsBody.payloads.length, 1);
      assert.equal(payloadsBody.payloads[0].address, sender);

      // 5. Parse the unsigned transaction to verify operations
      const parseUnsignedRes = await post(fastify, '/construction/parse', {
        network_identifier: NETWORK_IDENTIFIER,
        signed: false,
        transaction: payloadsBody.unsigned_transaction,
      });
      assert.equal(parseUnsignedRes.statusCode, 200);
      const parsedUnsigned = JSON.parse(parseUnsignedRes.body);
      const parsedTransferOps = parsedUnsigned.operations.filter(
        (op: { type: string }) => op.type === 'token_transfer'
      );
      assert.equal(parsedTransferOps.length, 2);

      // 6. Sign offline
      const sighash = payloadsBody.payloads[0].hex_bytes;
      const signature = signWithKey(E2E_SENDER_PRIVATE_KEY, sighash);

      // 7. Combine
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [{
          signing_payload: {
            hex_bytes: sighash,
            address: sender,
            signature_type: 'ecdsa_recovery',
          },
          public_key: { hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
          signature_type: 'ecdsa_recovery',
          hex_bytes: signature,
        }],
      });
      assert.equal(combineRes.statusCode, 200);
      const signedTx = JSON.parse(combineRes.body).signed_transaction;

      // 8. Parse the signed transaction — should include signers
      const parseSignedRes = await post(fastify, '/construction/parse', {
        network_identifier: NETWORK_IDENTIFIER,
        signed: true,
        transaction: signedTx,
      });
      assert.equal(parseSignedRes.statusCode, 200);
      const parsedSigned = JSON.parse(parseSignedRes.body);
      assert.ok(parsedSigned.account_identifier_signers);
      assert.equal(parsedSigned.account_identifier_signers[0].address, sender);

      // 9. Hash
      const hashRes = await post(fastify, '/construction/hash', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      assert.equal(hashRes.statusCode, 200);
      const txid = JSON.parse(hashRes.body).transaction_identifier.hash;
      assert.match(txid, /^0x[0-9a-f]{64}$/);

      // 10. Submit
      const submitRes = await post(fastify, '/construction/submit', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      assert.equal(submitRes.statusCode, 200, `submit failed: ${submitRes.body}`);
      const submitBody = JSON.parse(submitRes.body);
      assert.equal(submitBody.transaction_identifier.hash, txid);

      // 11. Wait for confirmation — the regtest node mines every 0.1s
      await waitForNonceAdvance(fastify, sender, senderNonce);
    });

    test('rejects a duplicate broadcast of the same transaction', { timeout: 30_000 }, async () => {
      // Build and submit a transaction (uses E2E accounts to avoid nonce conflicts)
      const metaRes = await post(fastify, '/construction/metadata', {
        network_identifier: NETWORK_IDENTIFIER,
        options: { sender_addresses: [e2eSenderAddress], recipient_addresses: [e2eRecipientAddress], operation_count: 3 },
        public_keys: [{ hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const metadata = JSON.parse(metaRes.body).metadata;

      const payloadsRes = await post(fastify, '/construction/payloads', {
        network_identifier: NETWORK_IDENTIFIER,
        operations: [
          { operation_identifier: { index: 0 }, type: 'fee', account: { address: e2eSenderAddress }, amount: { value: '-10000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 1 }, type: 'token_transfer', account: { address: e2eSenderAddress }, amount: { value: '-50000', currency: { symbol: 'STX', decimals: 6 } } },
          { operation_identifier: { index: 2 }, type: 'token_transfer', account: { address: e2eRecipientAddress }, amount: { value: '50000', currency: { symbol: 'STX', decimals: 6 } } },
        ],
        metadata,
        public_keys: [{ hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
      });
      const payloadsBody = JSON.parse(payloadsRes.body);
      const signature = signWithKey(E2E_SENDER_PRIVATE_KEY, payloadsBody.payloads[0].hex_bytes);
      const combineRes = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: payloadsBody.unsigned_transaction,
        signatures: [{
          signing_payload: { hex_bytes: payloadsBody.payloads[0].hex_bytes, address: e2eSenderAddress, signature_type: 'ecdsa_recovery' },
          public_key: { hex_bytes: E2E_SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
          signature_type: 'ecdsa_recovery',
          hex_bytes: signature,
        }],
      });
      const signedTx = JSON.parse(combineRes.body).signed_transaction;

      // First submit should succeed
      const firstSubmit = await post(fastify, '/construction/submit', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      assert.equal(firstSubmit.statusCode, 200, `first submit failed: ${firstSubmit.body}`);

      // Wait a moment for the tx to be accepted into the mempool
      await new Promise((r) => setTimeout(r, 2000));

      // Second submit of the same transaction should either:
      // - fail with 500 (ConflictingNonceInMempool) if still pending, or
      // - succeed with 200 returning the same txid (idempotent) if already mined
      const secondSubmit = await post(fastify, '/construction/submit', {
        network_identifier: NETWORK_IDENTIFIER,
        signed_transaction: signedTx,
      });
      if (secondSubmit.statusCode === 200) {
        const secondBody = JSON.parse(secondSubmit.body);
        const firstBody = JSON.parse(firstSubmit.body);
        assert.equal(secondBody.transaction_identifier.hash, firstBody.transaction_identifier.hash);
      } else {
        assert.equal(secondSubmit.statusCode, 500);
      }
    });
  });
});
