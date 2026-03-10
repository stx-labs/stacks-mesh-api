import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
import {
  ErrorResponseSchema,
  MetadataRequestSchema,
  NetworkListResponse,
  NetworkListResponseSchema,
  NetworkOptionsRequestSchema,
  NetworkOptionsResponse,
  NetworkOptionsResponseSchema,
  NetworkStatusRequestSchema,
  NetworkStatusResponse,
  NetworkStatusResponseSchema,
  Peer,
} from '../../../../schemas/dist/index.js';
import { getAllErrors } from '../../utils/errors.js';
import {
  CALL_METHODS,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  MESH_SPECIFICATION_VERSION,
  GENESIS_BLOCK_HASH,
  GENESIS_BLOCK_TIMESTAMP,
} from '../../utils/constants.js';
import codec from '@stacks/codec';
import { addHexPrefix } from '../../serializers/index.js';
import { getChainTipNakamotoBlock } from '../../utils/helpers.js';

export const NetworkRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  const { rpcClient, network, nodeVersion, apiVersion } = config;

  fastify.post(
    '/network/list',
    {
      schema: {
        body: MetadataRequestSchema,
        tags: ['Network'],
        response: {
          200: NetworkListResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const response: NetworkListResponse = {
        network_identifiers: [{ blockchain: 'stacks', network }],
      };
      return reply.send(response);
    }
  );

  fastify.post(
    '/network/status',
    {
      schema: {
        body: NetworkStatusRequestSchema,
        tags: ['Network'],
        response: {
          200: NetworkStatusResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const [chainTip, neighbors] = await Promise.all([
        getChainTipNakamotoBlock(rpcClient),
        rpcClient.getNeighbors(),
      ]);
      const { decodedBlock: chainTipNakamotoBlock, nodeInfo } = chainTip;

      // Create a map of public key hash to peer for deduplication.
      const peerMap = new Map<string, Peer>();
      const neighborGroups = [
        { peers: neighbors.bootstrap, type: 'bootstrap' },
        { peers: neighbors.sample, type: 'sample' },
        { peers: neighbors.inbound, type: 'inbound' },
        { peers: neighbors.outbound, type: 'outbound' },
      ] as const;
      for (const { peers, type } of neighborGroups) {
        for (const peer of peers) {
          const existing = peerMap.get(peer.public_key_hash);
          if (existing) {
            existing.metadata.type.push(type);
          } else {
            peerMap.set(peer.public_key_hash, {
              peer_id: peer.public_key_hash,
              metadata: {
                ip: peer.ip,
                port: peer.port,
                peer_version: peer.peer_version,
                type: [type],
              },
            });
          }
        }
      }

      const blockIndex = Number(chainTipNakamotoBlock.header.chain_length);
      const response: NetworkStatusResponse = {
        current_block_identifier: {
          index: blockIndex,
          hash: addHexPrefix(chainTipNakamotoBlock.header.index_block_hash),
        },
        current_block_timestamp: Number(chainTipNakamotoBlock.header.timestamp) * 1000,
        genesis_block_identifier: {
          index: 1,
          hash: GENESIS_BLOCK_HASH[network],
        },
        sync_status: {
          current_index: blockIndex,
          synced: nodeInfo.is_fully_synced,
        },
        peers: Array.from(peerMap.values()),
      };

      return reply.send(response);
    }
  );

  fastify.post(
    '/network/options',
    {
      schema: {
        body: NetworkOptionsRequestSchema,
        tags: ['Network'],
        response: {
          200: NetworkOptionsResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const response: NetworkOptionsResponse = {
        version: {
          rosetta_version: MESH_SPECIFICATION_VERSION,
          node_version: nodeVersion,
          middleware_version: apiVersion,
        },
        allow: {
          operation_statuses: OPERATION_STATUSES,
          operation_types: OPERATION_TYPES,
          errors: getAllErrors(),
          historical_balance_lookup: true,
          timestamp_start_index: GENESIS_BLOCK_TIMESTAMP,
          call_methods: CALL_METHODS,
          balance_exemptions: [],
          mempool_coins: false,
          block_hash_case: 'lower_case',
          transaction_hash_case: 'lower_case',
        },
      };

      return reply.send(response);
    }
  );
};
