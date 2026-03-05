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
} from './helpers.js';

describe('/construction/parse', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;

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
    test('parses an unsigned transaction into operations', async () => {
      const unsignedTx =
        '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003020000000000051a43596b5386f466863e25658ddf94bd0fadab004800000000000f424068656c6c6f0000000000000000000000000000000000000000000000000000000000';
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
      assert.equal(senderOp.amount.value, '-1000000');
      assert.equal(recipientOp.amount.value, '1000000');

      // Unsigned transaction should not have signers
      assert.ok(!body.account_identifier_signers);
    });

    test('parses a signed transaction and includes signers', async () => {
      const signedTx =
        '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c8000167b4c3fe49a0e2c99c83d2a181713c164604b4dbd516ef1641596231c070526e217fea3d9db5c0a81008a19b38640c78fa580fcc792f7362f21699e61defc45103020000000000051a43596b5386f466863e25658ddf94bd0fadab004800000000000f424068656c6c6f0000000000000000000000000000000000000000000000000000000000';
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
      assert.equal(body.account_identifier_signers[0].address, SENDER_ADDRESS);
    });
  });

  // describe('contract_call', () => {
  //   test('parses a contract call transaction into operations', async () => {
  //     const contractCallTx =
  //       '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030200000000021a164247d6f2b425ac5771423ae6c80c754f7172b00568656c6c6f0568656c6c6f000000010701000000000000000000000069aa108e26';
  //     const res = await post(fastify, '/construction/parse', {
  //       network_identifier: NETWORK_IDENTIFIER,
  //       signed: false,
  //       transaction: contractCallTx,
  //     });
  //     assert.equal(res.statusCode, 200);
  //     const body = JSON.parse(res.body);
  //     assert.ok(body.operations.length >= 2);

  //     // Fee operation
  //     const feeOp = body.operations.find((op: { type: string }) => op.type === 'fee');
  //     assert.ok(feeOp);
  //     assert.equal(feeOp.amount.value, '-200');

  //     // Contract call operation
  //     const contractCallOps = body.operations.filter(
  //       (op: { type: string }) => op.type === 'contract_call'
  //     );
  //     assert.equal(contractCallOps.length, 1);
  //     assert.equal(contractCallOps[0].metadata.contract_identifier, 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.counter');
  //     assert.equal(contractCallOps[0].metadata.function_name, 'increment');
  //     assert.equal(contractCallOps[0].metadata.args.length, 1);

  //     // Unsigned transaction should not have signers
  //     assert.ok(!body.account_identifier_signers);
  //   });
  // });

  describe('contract_deploy', () => {
    test('parses a contract deploy transaction into operations', async () => {
      const contractDeployTx =
        '0x80800000000400164247d6f2b425ac5771423ae6c80c754f7172b0000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030200000000060107636f756e746572000001990a202028646566696e652d646174612d76617220636f756e7465722075696e74207530290a202028646566696e652d726561642d6f6e6c7920286765742d636f756e746572290a20202020286f6b20287661722d67657420636f756e74657229290a2020290a202028646566696e652d7075626c69632028696e6372656d656e74290a2020202028626567696e0a202020202020287661722d73657420636f756e74657220282b20287661722d67657420636f756e7465722920753129290a202020202020286f6b20287661722d67657420636f756e74657229290a20202020290a2020290a202028646566696e652d7075626c6963202864656372656d656e74290a2020202028626567696e0a20202020202028617373657274732120283e20287661722d67657420636f756e7465722920753029202865727220753129290a202020202020287661722d73657420636f756e74657220282d20287661722d67657420636f756e7465722920753129290a202020202020286f6b20287661722d67657420636f756e74657229290a20202020290a2020290a';
      const res = await post(fastify, '/construction/parse', {
        network_identifier: NETWORK_IDENTIFIER,
        signed: false,
        transaction: contractDeployTx,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.operations.length >= 2);

      // Fee operation
      const feeOp = body.operations.find((op: { type: string }) => op.type === 'fee');
      assert.ok(feeOp);
      assert.equal(feeOp.amount.value, '-200');

      // Contract deploy operation
      const contractDeployOps = body.operations.filter(
        (op: { type: string }) => op.type === 'contract_deploy'
      );
      assert.equal(contractDeployOps.length, 1);
      assert.equal(
        contractDeployOps[0].metadata.contract_identifier,
        'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.counter'
      );
      assert.ok(contractDeployOps[0].metadata.source_code);
      assert.equal(contractDeployOps[0].metadata.clarity_version, 1);

      // Unsigned transaction should not have signers
      assert.ok(!body.account_identifier_signers);
    });
  });
});
