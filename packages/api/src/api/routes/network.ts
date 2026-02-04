import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  MetadataRequestSchema,
  NetworkRequestSchema,
  NetworkListResponseSchema,
  NetworkStatusResponseSchema,
  NetworkOptionsResponseSchema,
  MeshErrorSchema,
  type NetworkListResponse,
  type NetworkStatusResponse,
  type NetworkOptionsResponse,
} from '../../api/schemas.js';
import {
  MAINNET_IDENTIFIER,
  TESTNET_IDENTIFIER,
  MESH_VERSION,
  OPERATION_TYPES,
  OPERATION_STATUSES,
  CALL_METHODS,
  STX_CURRENCY,
} from '../../utils/constants.js';
import { MeshErrors, getAllErrors } from '../../utils/errors.js';
import { validateNetwork } from '../../utils/validation.js';
import type { RouteConfig } from '../index.js';

export const networkRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  const supportedNetworkIdentifier =
    network === 'mainnet' ? MAINNET_IDENTIFIER : TESTNET_IDENTIFIER;

  // POST /network/list
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
        network_identifiers: [supportedNetworkIdentifier],
      };
      return reply.send(response);
    }
  );

  // POST /network/status
  fastify.post(
    '/network/status',
    {
      schema: {
        body: NetworkRequestSchema,
        response: {
          200: NetworkStatusResponseSchema,
          500: MeshErrorSchema,
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
          current_block_timestamp: Date.now(),
          genesis_block_identifier: {
            index: 0,
            hash: nodeInfo.genesis_chainstate_hash,
          },
          sync_status: {
            current_index: nodeInfo.stacks_tip_height,
            synced: true,
          },
          peers: neighbors.outbound.map((peer) => ({
            peer_id: peer.public_key_hash,
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

  // POST /network/options
  fastify.post(
    '/network/options',
    {
      schema: {
        body: NetworkRequestSchema,
        response: {
          200: NetworkOptionsResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const networkError = validateNetwork(request.body.network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        const nodeInfo = await rpcClient.getInfo();

        const response: NetworkOptionsResponse = {
          version: {
            rosetta_version: MESH_VERSION,
            node_version: nodeInfo.server_version,
            middleware_version: '1.0.0',
            metadata: {
              network_id: nodeInfo.network_id,
              peer_version: nodeInfo.peer_version,
            },
          },
          allow: {
            operation_statuses: OPERATION_STATUSES,
            operation_types: [...OPERATION_TYPES],
            errors: getAllErrors(),
            historical_balance_lookup: true,
            timestamp_start_index: 1,
            call_methods: [...CALL_METHODS],
            balance_exemptions: [
              {
                sub_account_address: 'locked',
                currency: STX_CURRENCY,
                exemption_type: 'dynamic',
              },
            ],
            mempool_coins: false,
            block_hash_case: 'lower_case',
            transaction_hash_case: 'lower_case',
          },
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );
};
