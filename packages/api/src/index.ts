import { ENV } from './env.js';
import { logger, registerShutdownConfig, SERVER_VERSION, timeout } from '@stacks/api-toolkit';
import { ApiConfig, buildApiServer } from './api/index.js';
import { getStacksNetworkName } from './utils/helpers.js';
import { TokenMetadataCache } from './cache/token-metadata-cache.js';
import { ContractAbiCache } from './cache/contract-abi-cache.js';
import { CoreRpcClient, createCoreRpcClient, NodeInfo } from '@stacks/rpc-client';

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

export async function initApp() {
  const rpcClient = createCoreRpcClient({
    baseUrl: `${ENV.STACKS_CORE_RPC_SCHEME}://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`,
    authToken: ENV.STACKS_CORE_RPC_AUTH_TOKEN,
  });
  const nodeInfo = await waitForNodeReady(rpcClient);

  const tokenMetadataCache = new TokenMetadataCache({
    rpcClient,
    cacheSize: ENV.TOKEN_METADATA_CACHE_SIZE,
    ttl: ENV.TOKEN_METADATA_CACHE_TTL_MS,
  });
  const contractAbiCache = new ContractAbiCache({
    rpcClient,
    cacheSize: ENV.CONTRACT_ABI_CACHE_SIZE,
    ttl: ENV.CONTRACT_ABI_CACHE_TTL_MS,
  });

  const apiConfig: ApiConfig = {
    rpcClient,
    network: getStacksNetworkName(nodeInfo.network_id),
    nodeVersion: nodeInfo.server_version,
    apiVersion: `stacks-mesh-api ${SERVER_VERSION.tag} (${SERVER_VERSION.branch}:${SERVER_VERSION.commit})`,
    tokenMetadataCache,
    contractAbiCache,
  };
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
