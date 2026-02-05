import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RouteConfig } from '../index.js';
import { BlockRoutes } from './block.js';
import { NetworkRoutes } from './network.js';
import { AccountRoutes } from './account.js';
import { MempoolRoutes } from './mempool.js';
import { ConstructionRoutes } from './construction.js';
import { CallRoutes } from './call.js';
import { FastifyError } from 'fastify';

export const MeshApiRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
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

  await fastify.register(NetworkRoutes, config);
  await fastify.register(BlockRoutes, config);
  await fastify.register(AccountRoutes, config);
  await fastify.register(MempoolRoutes, config);
  await fastify.register(ConstructionRoutes, config);
  await fastify.register(CallRoutes, config);
};
