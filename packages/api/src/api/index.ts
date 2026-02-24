import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { StacksRpcClient } from '../stacks-rpc/stacks-rpc-client.js';
import { PINO_LOGGER_CONFIG } from '@stacks/api-toolkit';
import { MeshApiRoutes } from './routes/index.js';
import cors from '@fastify/cors';
import { TokenMetadataCache } from '../cache/token-metadata-cache.js';
import { ContractAbiCache } from '../cache/contract-abi-cache.js';

export type ApiConfig = {
  rpcClient: StacksRpcClient;
  tokenMetadataCache: TokenMetadataCache;
  contractAbiCache: ContractAbiCache;
  network: 'mainnet' | 'testnet';
  nodeVersion: string;
};

export async function buildApiServer(config: ApiConfig) {
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
