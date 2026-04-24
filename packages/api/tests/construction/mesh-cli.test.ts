import * as assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  ensureMeshCli,
  waitForNakamotoBlock,
  API_PORT,
  SENDER_ADDRESS,
  SENDER_PRIVATE_KEY,
} from './helpers.js';
import type { DockerTestContainerConfig } from '@stacks/api-test-toolkit';

// TODO: Unskip once we update the `stacks-regtest-env` image.
describe.skip('Mesh CLI check:construction', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerTestContainerConfig[];
  let meshCliBin: string;
  let senderAddress: string = SENDER_ADDRESS;
  let configDir: string;

  before(async () => {
    [dockerResources, meshCliBin] = await Promise.all([
      setupDockerServices(),
      ensureMeshCli(),
    ]);
    fastify = await buildTestServer();
    await fastify.listen({ host: '0.0.0.0', port: API_PORT });
    await waitForNakamotoBlock();
    configDir = await mkdtemp(join(tmpdir(), 'mesh-cli-'));
  }, { timeout: 180_000 });

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
            privkey: SENDER_PRIVATE_KEY.slice(0, 64),
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

    const exitCode = await new Promise<number>((resolve, reject) => {
      const proc = spawn(
        meshCliBin,
        ['check:construction', '--configuration-file', configPath],
        { stdio: ['ignore', 2, 2], timeout: 230_000 }
      );
      proc.on('close', (code) => resolve(code ?? 1));
      proc.on('error', reject);
    });
    assert.equal(exitCode, 0, `mesh CLI check:construction failed (exit code ${exitCode})`);
  });
});
