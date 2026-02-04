import { StacksRpcClient } from './services/stacks-rpc-client.js';
import { ENV } from './env.js';
import { logger, registerShutdownConfig } from '@hirosystems/api-toolkit';
import { buildApiServer } from './api/index.js';

export async function initApp() {
  const rpcClient = new StacksRpcClient({
    baseUrl: `http://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`,
  });
  const apiServer = await buildApiServer({
    rpcClient,
    network: ENV.STACKS_NETWORK,
  });
  registerShutdownConfig({
    name: 'API Server',
    forceKillable: false,
    handler: async () => {
      await apiServer.close();
    },
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
