import { StacksRpcClient } from './stacks-rpc/stacks-rpc-client.js';
import { ENV } from './env.js';
import { logger, registerShutdownConfig } from '@stacks/api-toolkit';
import { buildApiServer } from './api/index.js';
import { getStacksNetworkName } from './utils/constants.js';
import { TokenMetadataCache } from './utils/token-metadata-cache.js';

export async function initApp() {
  const rpcClient = new StacksRpcClient({
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

  const apiServer = await buildApiServer({
    rpcClient,
    network: getStacksNetworkName(nodeInfo.network_id),
    nodeVersion: nodeInfo.server_version,
    tokenMetadataCache,
  });
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
