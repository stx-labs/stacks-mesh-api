import * as assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  API_PORT,
  post,
  NETWORK_IDENTIFIER,
  SENDER_ADDRESS,
  SENDER_PUBLIC_KEY,
  SENDER_PRIVATE_KEY,
} from './helpers.js';
import { signWithKey } from '@stacks/transactions';
import { addHexPrefix, removeHexPrefix } from '../../src/serializers/index.js';
import type { DockerTestContainerConfig } from '@stacks/api-test-toolkit';

describe('/construction/combine', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerTestContainerConfig[];
  let senderAddress = SENDER_ADDRESS;
  let senderPublicKey = `0x${SENDER_PUBLIC_KEY}`;

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
    let unsignedTx =
      '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003020000000000051a43596b5386f466863e25658ddf94bd0fadab004800000000000f424068656c6c6f0000000000000000000000000000000000000000000000000000000000';
    let sighash = '0xd25712972639056fdacfdbeb836d57978a3fb1b341a2f3352d1721162904e62e';

    test('combines unsigned transaction with a valid signature', async () => {
      // Sign the sighash offline
      const signature = addHexPrefix(signWithKey(SENDER_PRIVATE_KEY, removeHexPrefix(sighash)));

      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: unsignedTx,
        signatures: [
          {
            signing_payload: {
              hex_bytes: sighash,
              address: senderAddress,
              account_identifier: {
                address: senderAddress,
              },
              signature_type: 'ecdsa_recovery',
            },
            public_key: {
              hex_bytes: senderPublicKey,
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

    test('combines unsigned transaction when signing payload address is omitted', async () => {
      // Sign the sighash offline
      const signature = addHexPrefix(signWithKey(SENDER_PRIVATE_KEY, removeHexPrefix(sighash)));

      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: unsignedTx,
        signatures: [
          {
            signing_payload: {
              hex_bytes: sighash,
              account_identifier: {
                address: senderAddress,
              },
              signature_type: 'ecdsa_recovery',
            },
            public_key: {
              hex_bytes: senderPublicKey,
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
      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: unsignedTx,
        signatures: [],
      });
      assert.equal(res.statusCode, 500);
    });

    test('rejects a signature with invalid length', async () => {
      const res = await post(fastify, '/construction/combine', {
        network_identifier: NETWORK_IDENTIFIER,
        unsigned_transaction: unsignedTx,
        signatures: [
          {
            signing_payload: {
              hex_bytes: sighash,
              address: senderAddress,
              account_identifier: {
                address: senderAddress,
              },
              signature_type: 'ecdsa_recovery',
            },
            public_key: { hex_bytes: senderPublicKey, curve_type: 'secp256k1' },
            signature_type: 'ecdsa_recovery',
            hex_bytes: '0xaabbccdd', // Too short
          },
        ],
      });
      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.description, /Invalid signature length/);
    });
  });
});
