import Fastify, { FastifyError } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { StacksRpcClient } from '../services/stacks-rpc.js';
import { PINO_LOGGER_CONFIG } from '@hirosystems/api-toolkit';
import {
  accountRoutes,
  blockRoutes,
  constructionRoutes,
  mempoolRoutes,
  callRoutes,
  networkRoutes,
} from './routes/index.js';
import cors from '@fastify/cors';

export type RouteConfig = {
  rpcClient: StacksRpcClient;
  network: 'mainnet' | 'testnet';
};

export async function buildApiServer(config: RouteConfig) {
  const fastify = Fastify({
    trustProxy: true,
    logger: PINO_LOGGER_CONFIG,
  }).withTypeProvider<TypeBoxTypeProvider>();

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

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  await fastify.register(networkRoutes, config);
  await fastify.register(blockRoutes, config);
  await fastify.register(accountRoutes, config);
  await fastify.register(mempoolRoutes, config);
  await fastify.register(constructionRoutes, config);
  await fastify.register(callRoutes, config);

  return fastify;
}
