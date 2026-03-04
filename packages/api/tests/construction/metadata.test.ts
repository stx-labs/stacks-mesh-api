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
} from './helpers.js';
import {
  ConstructionPreprocessContractCallOptions,
  ConstructionPreprocessContractDeployOptions,
  ConstructionPreprocessTokenTransferOptions,
} from '@stacks/mesh-schemas';

describe('/construction/metadata', () => {
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

  test('returns metadata for token_transfer', async () => {
    const options: ConstructionPreprocessTokenTransferOptions = {
      sender_address: senderAddress,
      recipient_address: recipientAddress,
      type: 'token_transfer',
      max_fee: '10000',
      suggested_fee_multiplier: 1.5,
      amount: '1000000',
      memo: 'hello',
    };
    const res = await post(fastify, '/construction/metadata', {
      network_identifier: NETWORK_IDENTIFIER,
      options,
      public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, {
      metadata: {
        options: {
          sender_address: senderAddress,
          recipient_address: recipientAddress,
          type: 'token_transfer',
          max_fee: options.max_fee,
          suggested_fee_multiplier: options.suggested_fee_multiplier,
          amount: options.amount,
          memo: options.memo,
        },
        sender_account_info: {
          nonce: 0,
          balance: '10000000000000000',
        },
      },
      suggested_fee: [
        {
          currency: {
            decimals: 6,
            symbol: 'STX',
          },
          value: '98',
        },
      ],
    });
  });

  test('returns metadata for contract_call', async () => {
    const options: ConstructionPreprocessContractCallOptions = {
      sender_address: senderAddress,
      type: 'contract_call',
      contract_identifier: 'SP21EK0KSQG7HEHBGCVRJGPGFMV8SCA2B85X01DK2.hello-world',
      function_name: 'increment',
      args: [],
      max_fee: '10000',
      suggested_fee_multiplier: 1.5,
    };
    const res = await post(fastify, '/construction/metadata', {
      network_identifier: NETWORK_IDENTIFIER,
      options,
      public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, {
      metadata: {
        options: {
          sender_address: senderAddress,
          type: 'contract_call',
          contract_identifier: options.contract_identifier,
          function_name: options.function_name,
          args: options.args,
          max_fee: options.max_fee,
          suggested_fee_multiplier: options.suggested_fee_multiplier,
        },
        sender_account_info: {
          nonce: 0,
          balance: '10000000000000000',
        },
      },
      suggested_fee: [
        {
          currency: {
            decimals: 6,
            symbol: 'STX',
          },
          value: '72',
        },
      ],
    });
  });

  test('returns metadata for contract_deploy', async () => {
    const options: ConstructionPreprocessContractDeployOptions = {
      sender_address: senderAddress,
      type: 'contract_deploy',
      contract_name: 'hello-world',
      clarity_version: 3,
      source_code: 'hello world',
      max_fee: '10000',
      suggested_fee_multiplier: 1.5,
    };
    const res = await post(fastify, '/construction/metadata', {
      network_identifier: NETWORK_IDENTIFIER,
      options,
      public_keys: [{ hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' }],
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, {
      metadata: {
        options: {
          sender_address: senderAddress,
          type: 'contract_deploy',
          contract_name: options.contract_name,
          clarity_version: options.clarity_version,
          source_code: options.source_code,
          max_fee: options.max_fee,
          suggested_fee_multiplier: options.suggested_fee_multiplier,
        },
        sender_account_info: {
          nonce: 0,
          balance: '10000000000000000',
        },
      },
      suggested_fee: [
        {
          currency: {
            decimals: 6,
            symbol: 'STX',
          },
          value: '44',
        },
      ],
    });
  });
});
