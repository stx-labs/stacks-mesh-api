import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { PINO_LOGGER_CONFIG } from '@stacks/api-toolkit';
import { MeshApiRoutes } from './routes/index.js';
import cors from '@fastify/cors';
import { TokenMetadataCache } from '../cache/token-metadata-cache.js';
import { ContractAbiCache } from '../cache/contract-abi-cache.js';
import { CoreRpcClient } from '@stacks/rpc-client';
import type { StacksNetwork } from '@stacks/network';
import type { StacksNetworkName } from '../utils/helpers.js';

type BaseApiConfig = {
  tokenMetadataCache: TokenMetadataCache;
  contractAbiCache: ContractAbiCache;
  /** Network format label — address version bytes, PoX boot address, request validation. */
  networkName: StacksNetworkName;
  /** Network object (with the node's actual chain ID) used for transaction construction/signing. */
  network: StacksNetwork;
  nodeVersion: string;
  apiVersion: string;
};

/** Full config: connected to a node, serves the entire API. */
export type OnlineApiConfig = BaseApiConfig & {
  mode: 'online';
  rpcClient: CoreRpcClient;
};

/**
 * Node-less config: serves only the offline endpoints (offline Construction subset +
 * `/network/list` + `/network/options`) and makes no outbound calls. `network`/`networkName` come
 * from `STACKS_CHAIN_ID` instead of the node.
 */
export type OfflineApiConfig = BaseApiConfig & {
  mode: 'offline';
};

export type ApiConfig = OnlineApiConfig | OfflineApiConfig;

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
