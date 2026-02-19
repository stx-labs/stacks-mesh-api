import { StacksRpcClient } from './services/stacks-rpc-client.js';
import { ENV } from './env.js';
import { logger, registerShutdownConfig } from '@stacks/api-toolkit';
import { buildApiServer } from './api/index.js';
import { getStacksNetworkName } from './utils/constants.js';

export async function initApp() {
  const rpcClient = new StacksRpcClient({
    baseUrl: `http://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`,
    authToken: ENV.STACKS_CORE_RPC_AUTH_TOKEN,
  });
  const nodeInfo = await rpcClient.getInfo();
  // TODO: use this to check node connection status
  const network = getStacksNetworkName(nodeInfo.network_id);

  const apiServer = await buildApiServer({
    rpcClient,
    network,
    nodeVersion: nodeInfo.server_version,
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
