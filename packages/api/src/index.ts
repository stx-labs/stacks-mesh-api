import { StacksRpcClient } from './stacks-rpc/stacks-rpc-client.js';
import { ENV } from './env.js';
import { logger, registerShutdownConfig, SERVER_VERSION } from '@stacks/api-toolkit';
import { ApiConfig, buildApiServer } from './api/index.js';
import { getStacksNetworkName } from './utils/helpers.js';
import { TokenMetadataCache } from './cache/token-metadata-cache.js';
import { ContractAbiCache } from './cache/contract-abi-cache.js';

export async function initApp() {
  const rpcClient = new StacksRpcClient({
    scheme: ENV.STACKS_CORE_RPC_SCHEME,
    hostname: ENV.STACKS_CORE_RPC_HOST,
    port: ENV.STACKS_CORE_RPC_PORT,
    authToken: ENV.STACKS_CORE_RPC_AUTH_TOKEN,
    timeout: ENV.STACKS_CORE_RPC_TIMEOUT_MS,
  });
  const nodeInfo = await rpcClient.waitForNodeReady();

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
