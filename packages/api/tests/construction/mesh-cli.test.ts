import * as assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { privateKeyToPublic } from '@stacks/transactions';

import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  ensureMeshCli,
  API_PORT,
  type DockerResources,
} from './helpers.js';

const execFile = promisify(execFileCb);

// Funded account from the Docker image's genesis allocation (see config.toml [[ustx_balance]])
const SENDER_PRIVATE_KEY =
  'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
const SENDER_PUBLIC_KEY = privateKeyToPublic(SENDER_PRIVATE_KEY);

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

describe('Mesh CLI check:construction', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;
  let meshCliBin: string;
  let senderAddress: string;
  let configDir: string;

  before(async () => {
    [dockerResources, meshCliBin] = await Promise.all([
      setupDockerServices(),
      ensureMeshCli(),
    ]);
    fastify = await buildTestServer();
    await fastify.listen({ host: '0.0.0.0', port: API_PORT });

    const deriveRes = await post(fastify, '/construction/derive', {
      network_identifier: NETWORK_IDENTIFIER,
      public_key: { hex_bytes: SENDER_PUBLIC_KEY, curve_type: 'secp256k1' },
    });
    senderAddress = JSON.parse(deriveRes.body).account_identifier.address;

    configDir = await mkdtemp(join(tmpdir(), 'mesh-cli-'));
  }, { timeout: 120_000 });

  after(async () => {
    await fastify?.close();
    await teardownDockerServices(dockerResources);
    if (configDir) await rm(configDir, { recursive: true, force: true });
  }, { timeout: 30_000 });

  test('passes rosetta-cli check:construction workflow', { timeout: 240_000 }, async () => {
    const configPath = join(configDir, 'construction-config.json');
    const dataDir = join(configDir, 'data');

    const config = {
      network: {
        blockchain: 'stacks',
        network: 'testnet',
      },
      online_url: `http://localhost:${API_PORT}`,
      data_directory: dataDir,
      http_timeout: 30,
      max_retries: 3,
      retry_elapsed_time: 10,
      construction: {
        offline_url: `http://localhost:${API_PORT}`,
        stale_depth: 0,
        broadcast_limit: 0,
        ignore_broadcast_failures: false,
        clear_broadcasts: false,
        broadcast_behind_tip: false,
        block_broadcast_limit: 0,
        rebroadcast_all: false,
        prefunded_accounts: [
          {
            privkey: SENDER_PRIVATE_KEY,
            account_identifier: { address: senderAddress },
            curve_type: 'secp256k1',
            currency: { symbol: 'STX', decimals: 6 },
          },
        ],
        end_conditions: {
          create_account: 1,
          transfer: 1,
        },
        workflows: [
          // request_funds: poll until the prefunded account has balance
          {
            name: 'request_funds',
            concurrency: 1,
            scenarios: [
              {
                name: 'find_account',
                actions: [
                  {
                    input: '{"symbol":"STX","decimals":6}',
                    type: 'set_variable',
                    output_path: 'currency',
                  },
                  {
                    input: '{"minimum_balance":{"value":"0","currency":{{currency}}},"create_limit":1}',
                    type: 'find_balance',
                    output_path: 'random_account',
                  },
                ],
              },
              {
                name: 'request',
                actions: [
                  {
                    input:
                      '{"account_identifier":{{random_account.account_identifier}},"minimum_balance":{"value":"1000000","currency":{{currency}}}}',
                    type: 'find_balance',
                    output_path: 'loaded_account',
                  },
                ],
              },
            ],
          },
          // create_account: generate a new keypair and derive address
          {
            name: 'create_account',
            concurrency: 1,
            scenarios: [
              {
                name: 'create_account',
                actions: [
                  {
                    input: '{"network":"testnet","blockchain":"stacks"}',
                    type: 'set_variable',
                    output_path: 'network',
                  },
                  {
                    input: '{"curve_type":"secp256k1"}',
                    type: 'generate_key',
                    output_path: 'key',
                  },
                  {
                    input:
                      '{"network_identifier":{{network}},"public_key":{{key.public_key}}}',
                    type: 'derive',
                    output_path: 'account',
                  },
                  {
                    input:
                      '{"account_identifier":{{account.account_identifier}},"keypair":{{key}}}',
                    type: 'save_account',
                    output_path: 'saved_account',
                  },
                ],
              },
            ],
          },
          // transfer: construct, sign, and broadcast an STX transfer
          {
            name: 'transfer',
            concurrency: 1,
            scenarios: [
              {
                name: 'transfer',
                actions: [
                  {
                    input: '{"symbol":"STX","decimals":6}',
                    type: 'set_variable',
                    output_path: 'currency',
                  },
                  {
                    input:
                      '{"minimum_balance":{"value":"100000","currency":{{currency}}}}',
                    type: 'find_balance',
                    output_path: 'sender',
                  },
                  {
                    input: '{"minimum":"1000","maximum":"50000"}',
                    type: 'random_number',
                    output_path: 'transfer_amount',
                  },
                  {
                    input:
                      '{"operation":"negation","left_value":{{transfer_amount.value}}}',
                    type: 'math',
                    output_path: 'negative_amount',
                  },
                  {
                    input:
                      '{"not_account_identifier":[{{sender.account_identifier}}],"minimum_balance":{"value":"0","currency":{{currency}}},"create_limit":1}',
                    type: 'find_balance',
                    output_path: 'recipient',
                  },
                  {
                    input: '{"network":"testnet","blockchain":"stacks"}',
                    type: 'set_variable',
                    output_path: 'transfer.network',
                  },
                  {
                    input:
                      '[{"operation_identifier":{"index":0},"type":"token_transfer","account":{"address":{{sender.account_identifier.address}}},"amount":{"value":{{negative_amount.value}},"currency":{{currency}}}},{"operation_identifier":{"index":1},"type":"token_transfer","account":{"address":{{recipient.account_identifier.address}}},"amount":{"value":{{transfer_amount.value}},"currency":{{currency}}}}]',
                    type: 'set_variable',
                    output_path: 'transfer.operations',
                  },
                  {
                    input: '"1"',
                    type: 'set_variable',
                    output_path: 'transfer.confirmation_depth',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    try {
      await execFile(
        meshCliBin,
        ['check:construction', '--configuration-file', configPath],
        { timeout: 230_000, maxBuffer: 10 * 1024 * 1024 }
      );
      // check:construction exits 0 on success; if we reach here it passed
      assert.ok(true, 'mesh CLI check:construction passed');
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      const output = [execError.stdout, execError.stderr].filter(Boolean).join('\n');
      assert.fail(
        `mesh CLI check:construction failed (exit code ${execError.code}):\n${output}`
      );
    }
  });
});
