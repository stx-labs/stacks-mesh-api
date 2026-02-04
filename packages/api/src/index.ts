import Fastify, { type FastifyError } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import { StacksRpcClient } from './services/stacks-rpc.js';
import {
  networkRoutes,
  blockRoutes,
  accountRoutes,
  mempoolRoutes,
  constructionRoutes,
  callRoutes,
} from './routes/index.js';
import { ENV } from './env.js';

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Custom error handler for validation errors
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.status(500).send({
        code: 902,
        message: 'Invalid request',
        retriable: false,
        description: error.message,
        details: {
          validation: error.validation,
        },
      });
    }

    return reply.status(500).send({
      code: 900,
      message: 'Internal error',
      retriable: true,
      description: error.message,
    });
  });

  // Create Stacks RPC client
  const rpcClient = new StacksRpcClient({
    baseUrl: `http://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`,
  });

  const routeConfig = {
    rpcClient,
    network: ENV.STACKS_NETWORK,
  };

  // Register all Mesh API routes
  await fastify.register(networkRoutes, routeConfig);
  await fastify.register(blockRoutes, routeConfig);
  await fastify.register(accountRoutes, routeConfig);
  await fastify.register(mempoolRoutes, routeConfig);
  await fastify.register(constructionRoutes, routeConfig);
  await fastify.register(callRoutes, routeConfig);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Root endpoint with API info
  fastify.get('/', async () => {
    return {
      name: 'Stacks Mesh API',
      version: '1.0.0',
      description: 'Mesh API implementation for the Stacks blockchain',
      network: ENV.STACKS_NETWORK,
      endpoints: {
        network: ['/network/list', '/network/status', '/network/options'],
        block: ['/block', '/block/transaction'],
        account: ['/account/balance', '/account/coins'],
        mempool: ['/mempool', '/mempool/transaction'],
        construction: [
          '/construction/derive',
          '/construction/preprocess',
          '/construction/metadata',
          '/construction/payloads',
          '/construction/combine',
          '/construction/parse',
          '/construction/hash',
          '/construction/submit',
        ],
        call: ['/call'],
      },
    };
  });

  return fastify;
}

async function main() {
  console.log(`Starting Stacks Mesh API server...`);
  console.log(`  Network: ${ENV.STACKS_NETWORK}`);
  console.log(`  Stacks RPC: ${`http://${ENV.STACKS_CORE_RPC_HOST}:${ENV.STACKS_CORE_RPC_PORT}`}`);

  const server = await createServer();

  try {
    await server.listen({ port: ENV.API_PORT, host: ENV.API_HOST });
    console.log(`Server listening on http://${ENV.API_HOST}:${ENV.API_PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Run if this is the entry point
main().catch(console.error);

// Export for testing and programmatic use
export { StacksRpcClient } from './services/stacks-rpc.js';
export * from './types/index.js';
