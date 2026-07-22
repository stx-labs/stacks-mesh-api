import { ENV } from './env.js';
import { logger, registerShutdownConfig, SERVER_VERSION, timeout } from '@stacks/api-toolkit';
import { ApiConfig, buildApiServer } from './api/index.js';
import { buildStacksNetwork, getStacksNetworkName } from './utils/helpers.js';
import { TokenMetadataCache } from './cache/token-metadata-cache.js';
import { ContractAbiCache } from './cache/contract-abi-cache.js';
import { CoreRpcClient, createCoreRpcClient, NodeInfo } from '@stacks/rpc-client';

const API_VERSION = `stacks-mesh-api ${SERVER_VERSION.tag} (${SERVER_VERSION.branch}:${SERVER_VERSION.commit})`;

async function waitForNodeReady(rpcClient: CoreRpcClient): Promise<NodeInfo> {
  logger.info(
    `Connecting to Stacks node at ${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}...`
  );
  while (true) {
    try {
      const nodeInfo = await rpcClient.request('GET', '/v2/info');
      logger.info(
        { server_version: nodeInfo.server_version, network_id: nodeInfo.network_id },
        `Connected to Stacks node`
      );
      return nodeInfo;
    } catch (error) {
      logger.warn(error, `Stacks node not ready, trying again in 1s...`);
      await timeout(1000);
    }
  }
}

/**
 * Build the offline-mode config: no node connection, no caches backed by a client, and the network
 * derived from `STACKS_CHAIN_ID` rather than `/v2/info`.
 */
function buildOfflineConfig(): ApiConfig {
  if (ENV.STACKS_CHAIN_ID == null) {
    throw new Error('STACKS_CHAIN_ID is required when MODE=offline');
  }
  const chainId = ENV.STACKS_CHAIN_ID;
  const networkName = getStacksNetworkName(chainId);
  const network = buildStacksNetwork(networkName, chainId);
  logger.info({ networkName, chain_id: chainId }, `Starting in OFFLINE mode`);
  return {
    mode: 'offline',
    networkName,
    network,
    blockHashMode: ENV.BLOCK_HASH_MODE,
    nodeVersion: 'offline',
    apiVersion: API_VERSION,
    // No rpcClient → these resolve to null without any outbound call (offline no-op).
    tokenMetadataCache: new TokenMetadataCache({
      cacheSize: ENV.TOKEN_METADATA_CACHE_SIZE,
      ttl: ENV.TOKEN_METADATA_CACHE_TTL_MS,
    }),
    contractAbiCache: new ContractAbiCache({
      cacheSize: ENV.CONTRACT_ABI_CACHE_SIZE,
      ttl: ENV.CONTRACT_ABI_CACHE_TTL_MS,
    }),
  };
}

/** Build the online-mode config: connect to the node and derive the network from `/v2/info`. */
async function buildOnlineConfig(): Promise<ApiConfig> {
  if (!ENV.STACKS_CORE_RPC_HOST || !ENV.STACKS_CORE_RPC_AUTH_TOKEN) {
    throw new Error(
      'STACKS_CORE_RPC_HOST and STACKS_CORE_RPC_AUTH_TOKEN are required when MODE=online'
    );
  }
  const rpcClient = createCoreRpcClient({
    baseUrl: `${ENV.STACKS_CORE_RPC_SCHEME}://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`,
    authToken: ENV.STACKS_CORE_RPC_AUTH_TOKEN,
  });
  const nodeInfo = await waitForNodeReady(rpcClient);

  if (ENV.STACKS_CHAIN_ID != null) {
    logger.warn(
      { configured_chain_id: ENV.STACKS_CHAIN_ID, node_chain_id: nodeInfo.network_id },
      `STACKS_CHAIN_ID is ignored in online mode; using the connected node's chain ID instead`
    );
  }

  const networkName = getStacksNetworkName(nodeInfo.network_id);
  // The chain ID for transaction signing always comes from the node, so a custom-chain-ID network
  // is supported without extra config (any non-mainnet chain ID resolves to testnet format).
  const network = buildStacksNetwork(networkName, nodeInfo.network_id);
  logger.info({ networkName, chain_id: nodeInfo.network_id }, `Resolved Stacks network`);

  return {
    mode: 'online',
    rpcClient,
    networkName,
    network,
    blockHashMode: ENV.BLOCK_HASH_MODE,
    nodeVersion: nodeInfo.server_version,
    apiVersion: API_VERSION,
    tokenMetadataCache: new TokenMetadataCache({
      rpcClient,
      cacheSize: ENV.TOKEN_METADATA_CACHE_SIZE,
      ttl: ENV.TOKEN_METADATA_CACHE_TTL_MS,
    }),
    contractAbiCache: new ContractAbiCache({
      rpcClient,
      cacheSize: ENV.CONTRACT_ABI_CACHE_SIZE,
      ttl: ENV.CONTRACT_ABI_CACHE_TTL_MS,
    }),
  };
}

export async function initApp() {
  const apiConfig = ENV.MODE === 'offline' ? buildOfflineConfig() : await buildOnlineConfig();
  const apiServer = await buildApiServer(apiConfig);
  registerShutdownConfig({
    name: 'API Server',
    forceKillable: false,
    handler: async () => {
      await apiServer.close();
    },
  });
  await apiServer.listen({
    host: ENV.API_HOST,
    port: ENV.API_PORT,
  });
}

registerShutdownConfig();
initApp()
  .then(() => {
    logger.info('API server initialized');
  })
  .catch(error => {
    logger.error(error, `API server failed to start`);
    process.exit(1);
  });
