import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
import {
  ErrorResponseSchema,
  MetadataRequestSchema,
  NetworkListResponse,
  NetworkListResponseSchema,
  NetworkStatusRequestSchema,
  NetworkStatusResponse,
  NetworkStatusResponseSchema,
  Peer,
} from '@stacks/mesh-serializer';
import { MeshErrors } from '../../utils/errors.js';
import { validateNetwork } from '../../utils/constants.js';

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
      const networkError = validateNetwork(request.body.network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
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
          ].map((peer): Peer => ({
            peer_id: peer.public_key_hash,
            // TODO: add more metadata
            metadata: {
              ip: peer.ip,
              port: peer.port,
            },
          })),
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );

  // // POST /network/options
  // fastify.post(
  //   '/network/options',
  //   {
  //     schema: {
  //       body: NetworkRequestSchema,
  //       response: {
  //         200: NetworkOptionsResponseSchema,
  //         500: MeshErrorSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     const networkError = validateNetwork(request.body.network_identifier, network);
  //     if (networkError) {
  //       return reply.status(500).send(networkError);
  //     }

  //     try {
  //       const nodeInfo = await rpcClient.getInfo();

  //       const response: NetworkOptionsResponse = {
  //         version: {
  //           rosetta_version: MESH_VERSION,
  //           node_version: nodeInfo.server_version,
  //           middleware_version: '1.0.0',
  //           metadata: {
  //             network_id: nodeInfo.network_id,
  //             peer_version: nodeInfo.peer_version,
  //           },
  //         },
  //         allow: {
  //           operation_statuses: OPERATION_STATUSES,
  //           operation_types: [...OPERATION_TYPES],
  //           errors: getAllErrors(),
  //           historical_balance_lookup: true,
  //           timestamp_start_index: 1,
  //           call_methods: [...CALL_METHODS],
  //           balance_exemptions: [
  //             {
  //               sub_account_address: 'locked',
  //               currency: STX_CURRENCY,
  //               exemption_type: 'dynamic',
  //             },
  //           ],
  //           mempool_coins: false,
  //           block_hash_case: 'lower_case',
  //           transaction_hash_case: 'lower_case',
  //         },
  //       };

  //       return reply.send(response);
  //     } catch (error) {
  //       const message = error instanceof Error ? error.message : 'Unknown error';
  //       return reply.status(500).send(MeshErrors.rpcError(message));
  //     }
  //   }
  // );
};
