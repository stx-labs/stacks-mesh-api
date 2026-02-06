import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
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
} from '@stacks/mesh-serializer';
import { getAllErrors } from '../../utils/errors.js';
import {
  CALL_METHODS,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  MESH_SPECIFICATION_VERSION,
} from '../../utils/constants.js';
import { SERVER_VERSION } from '@hirosystems/api-toolkit';

export const NetworkRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
  const { rpcClient, network } = config;

  fastify.post(
    '/network/list',
    {
      schema: {
        body: MetadataRequestSchema,
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
        response: {
          200: NetworkStatusResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const [nodeInfo, neighbors] = await Promise.all([
        rpcClient.getInfo(),
        rpcClient.getNeighbors(),
      ]);

      const response: NetworkStatusResponse = {
        current_block_identifier: {
          index: nodeInfo.stacks_tip_height,
          hash: nodeInfo.stacks_tip,
        },
        current_block_timestamp: Date.now(), // TODO: use the actual block timestamp
        genesis_block_identifier: {
          index: 0,
          hash: nodeInfo.genesis_chainstate_hash, // TODO: use the actual genesis block hash
        },
        sync_status: {
          current_index: nodeInfo.stacks_tip_height,
          synced: nodeInfo.is_fully_synced,
        },
        peers: [
          ...neighbors.bootstrap,
          ...neighbors.sample,
          ...neighbors.inbound,
          ...neighbors.outbound,
        ].map(
          (peer): Peer => ({
            peer_id: peer.public_key_hash,
            // TODO: add more metadata
            metadata: {
              ip: peer.ip,
              port: peer.port,
            },
          })
        ),
      };

      return reply.send(response);
    }
  );

  fastify.post(
    '/network/options',
    {
      schema: {
        body: NetworkOptionsRequestSchema,
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
          node_version: config.nodeVersion,
          middleware_version: `stacks-mesh-api ${SERVER_VERSION.tag} (${SERVER_VERSION.branch}:${SERVER_VERSION.commit})`,
        },
        allow: {
          operation_statuses: OPERATION_STATUSES,
          operation_types: OPERATION_TYPES,
          errors: getAllErrors(),
          historical_balance_lookup: true,
          timestamp_start_index: 1, // TODO: use the actual timestamp start index
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
