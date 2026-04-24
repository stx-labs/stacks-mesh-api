import { execFile as execFileCb } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { chmod, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Docker from 'dockerode';
import { buildApiServer } from '../../src/api/index.js';
import { TokenMetadataCache } from '../../src/cache/token-metadata-cache.js';
import { ContractAbiCache } from '../../src/cache/contract-abi-cache.js';
import { getStacksNetworkName } from '../../src/utils/helpers.js';
import { FastifyInstance } from 'fastify';
import { privateKeyToPublic } from '@stacks/transactions';
import { timeout } from '@stacks/api-toolkit';
import { createCoreRpcClient } from '@stacks/rpc-client';

const execFile = promisify(execFileCb);
const docker = new Docker();
const __dirname = dirname(fileURLToPath(import.meta.url));

const BIN_DIR = join(__dirname, '.bin');
const STACKS_IMAGE = 'hirosystems/stacks-api-e2e:stacks3.0-0a2c0e2';
const STACKS_CONTAINER_NAME = 'mesh-test-stacks';
const MESH_CLI_VERSION = '0.10.4';

export const API_PORT = 3999;

// Funded accounts from the Docker image's genesis allocation (see config.toml [[ustx_balance]])
export const SENDER_PRIVATE_KEY =
  'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
export const SENDER_PUBLIC_KEY = privateKeyToPublic(SENDER_PRIVATE_KEY);
export const SENDER_ADDRESS = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

// A second funded account to use as recipient
export const RECIPIENT_PRIVATE_KEY =
  '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
export const RECIPIENT_PUBLIC_KEY = privateKeyToPublic(RECIPIENT_PRIVATE_KEY);
export const RECIPIENT_ADDRESS = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';

export const NETWORK_IDENTIFIER = { blockchain: 'stacks', network: 'testnet' };

export const COUNTER_CONTRACT_SOURCE_CODE = `
  (define-data-var counter uint u0)
  (define-read-only (get-counter)
    (ok (var-get counter))
  )
  (define-public (increment)
    (begin
      (var-set counter (+ (var-get counter) u1))
      (ok (var-get counter))
    )
  )
  (define-public (decrement)
    (begin
      (asserts! (> (var-get counter) u0) (err u1))
      (var-set counter (- (var-get counter) u1))
      (ok (var-get counter))
    )
  )
`;

export type DockerResources = {
  stacksContainer: Docker.Container;
};

// ── Mesh CLI binary management ──────────────────────────────────────────────

function getMeshCliDownloadUrl(): string {
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return `https://github.com/coinbase/mesh-cli/releases/download/v${MESH_CLI_VERSION}/rosetta-cli-${MESH_CLI_VERSION}-${platform}-${arch}.tar.gz`;
}

/**
 * Ensures the mesh-cli (rosetta-cli) binary is available locally.
 * Downloads and extracts it on first run, then reuses the cached binary.
 * Returns the absolute path to the executable.
 */
export async function ensureMeshCli(): Promise<string> {
  const binaryPath = join(BIN_DIR, 'rosetta-cli');
  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  mkdirSync(BIN_DIR, { recursive: true });

  const url = getMeshCliDownloadUrl();
  const tarballPath = join(BIN_DIR, 'rosetta-cli.tar.gz');

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download mesh-cli: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(tarballPath));

  await execFile('tar', ['xzf', tarballPath, '-C', BIN_DIR]);
  await unlink(tarballPath);

  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const extractedName = `rosetta-cli-${MESH_CLI_VERSION}-${platform}-${arch}`;
  await rename(join(BIN_DIR, extractedName), binaryPath);
  await chmod(binaryPath, 0o755);

  if (process.platform === 'darwin') {
    await execFile('xattr', ['-rd', 'com.apple.quarantine', binaryPath]).catch(() => {});
    await execFile('codesign', ['--force', '--sign', '-', binaryPath]).catch(() => {});
  }

  return binaryPath;
}

/**
 * Runs a mesh-cli command using the local binary.
 */
export async function execMeshCli(
  meshCliBin: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFile(meshCliBin, args);
  return { stdout, stderr };
}

// ── Docker management ───────────────────────────────────────────────────────

async function pullImage(image: string): Promise<void> {
  const stream = await docker.pull(image);
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Removes any leftover containers from a previous test run.
 */
async function removeStaleContainers(): Promise<void> {
  try {
    const container = docker.getContainer(STACKS_CONTAINER_NAME);
    try {
      await container.stop();
    } catch {
      /* not running */
    }
    try {
      await container.remove({ v: true });
    } catch {
      /* already gone */
    }
  } catch {
    // Container doesn't exist
  }
}

/**
 * Pulls the image and starts the Stacks blockchain container in regtest mode.
 * Removes any stale containers from prior runs before starting.
 */
export async function setupDockerServices(): Promise<DockerResources> {
  await removeStaleContainers();
  await pullImage(STACKS_IMAGE);

  const stacksContainer = await docker.createContainer({
    Image: STACKS_IMAGE,
    name: STACKS_CONTAINER_NAME,
    ExposedPorts: {
      '18443/tcp': {},
      '18444/tcp': {},
      '20443/tcp': {},
      '20444/tcp': {},
    },
    Env: [
      'MINE_INTERVAL=0.1s',
      'STACKS_30_HEIGHT=131',
      // 'STACKS_EVENT_OBSERVER=host.docker.internal:3700',
    ],
    HostConfig: {
      PortBindings: {
        '18443/tcp': [{ HostPort: '18443' }],
        '18444/tcp': [{ HostPort: '18444' }],
        '20443/tcp': [{ HostPort: '20443' }],
        '20444/tcp': [{ HostPort: '20444' }],
      },
      ExtraHosts: ['host.docker.internal:host-gateway'],
    },
  });
  await stacksContainer.start();

  return { stacksContainer };
}

/**
 * Stops and removes all Docker resources created by {@link setupDockerServices}.
 * Errors during cleanup are swallowed so teardown always completes.
 */
export async function teardownDockerServices(resources: DockerResources): Promise<void> {
  try {
    await resources.stacksContainer.stop();
  } catch {
    // Container may already be stopped
  }
  try {
    await resources.stacksContainer.remove({ v: true });
  } catch {
    // Container may already be removed
  }
}

// ── Test server ─────────────────────────────────────────────────────────────

/**
 * Builds a Fastify server connected to the Docker-hosted Stacks blockchain.
 * Blocks until the node is ready to accept requests.
 */
export async function buildTestServer() {
  const rpcClient = createCoreRpcClient({
    baseUrl: 'http://localhost:20443',
    authToken: '',
  });
  const nodeInfo = await rpcClient.request('GET', '/v2/info');

  const tokenMetadataCache = new TokenMetadataCache({
    rpcClient,
    cacheSize: 100,
    ttl: 60_000,
  });
  const contractAbiCache = new ContractAbiCache({
    rpcClient,
    cacheSize: 100,
    ttl: 60_000,
  });

  return buildApiServer({
    rpcClient,
    network: getStacksNetworkName(nodeInfo.network_id),
    apiVersion: '1.0.0',
    nodeVersion: nodeInfo.server_version,
    tokenMetadataCache,
    contractAbiCache,
  });
}

/**
 * Waits until the Stacks chain has produced at least one Nakamoto block.
 * Pre-Nakamoto (epoch 2.x) blocks are not served by the v3 API, so this
 * must resolve before the Mesh/Rosetta `/block` endpoint can work.
 */
export async function waitForNakamotoBlock(): Promise<void> {
  const rpcClient = createCoreRpcClient({
    baseUrl: 'http://localhost:20443',
    authToken: '',
  });
  while (true) {
    try {
      const info = await rpcClient.request('GET', '/v2/info');
      console.log('Waiting for Nakamoto block...', info.stacks_tip_height);
      await rpcClient.request('GET', '/v3/blocks/height/{block_height}', {
        params: { path: { block_height: info.stacks_tip_height } },
      });
      return;
    } catch (error) {
      await timeout(1000);
    }
  }
}

/**
 * POSTs to the Fastify server.
 */
export async function post(
  fastify: FastifyInstance,
  url: string,
  payload: Record<string, unknown>
) {
  return fastify.inject({
    method: 'POST',
    url,
    payload: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
}
