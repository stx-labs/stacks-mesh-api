import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { StacksRpcClient } from '../services/stacks-rpc-client.js';
import { PINO_LOGGER_CONFIG } from '@hirosystems/api-toolkit';
import { MeshApiRoutes } from './routes/index.js';
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

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  await fastify.register(MeshApiRoutes, config);

  return fastify;
}
