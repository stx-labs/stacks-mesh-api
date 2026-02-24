import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiConfig } from '../index.js';
import { BlockRoutes } from './block.js';
import { NetworkRoutes } from './network.js';
import { AccountRoutes } from './account.js';
import { MempoolRoutes } from './mempool.js';
import { ConstructionRoutes } from './construction.js';
import { CallRoutes } from './call.js';
import { validateMeshRequest } from '../middleware/validations.js';
import { handleMeshError } from '../middleware/error-handlers.js';

export const MeshApiRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  fastify.setErrorHandler(handleMeshError);
  fastify.addHook('preHandler', validateMeshRequest(config));
  await fastify.register(NetworkRoutes, config);
  await fastify.register(BlockRoutes, config);
  await fastify.register(AccountRoutes, config);
  await fastify.register(MempoolRoutes, config);
  await fastify.register(ConstructionRoutes, config);
  await fastify.register(CallRoutes, config);
};
