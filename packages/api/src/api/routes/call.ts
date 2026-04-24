import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
import {
  CallRequestSchema,
  CallResponseSchema,
  ErrorResponseSchema,
} from '../../../../schemas/dist/index.js';
import { MeshErrors } from '../../utils/errors.js';
import { decodeClarityValue } from '../../serializers/index.js';
import { callReadOnlyFunction } from '../../stacks-rpc/helpers.js';

export const CallRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  const { rpcClient } = config;

  fastify.post(
    '/call',
    {
      schema: {
        body: CallRequestSchema,
        tags: ['Call'],
        response: {
          200: CallResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { method, parameters } = request.body;

      switch (method) {
        case 'contract_call_read_only': {
          const result = await callReadOnlyFunction(
            rpcClient,
            parameters.deployer_address,
            parameters.contract_name,
            parameters.function_name,
            parameters.arguments as string[],
            parameters.sender,
            parameters.sponsor
          );
          return reply.send({
            idempotent: false,
            result: decodeClarityValue(result),
          });
        }

        case 'contract_get_interface': {
          const result = await rpcClient.request(
            'GET',
            '/v2/contracts/interface/{deployer_address}/{contract_name}',
            {
              deployer_address: parameters.deployer_address,
              contract_name: parameters.contract_name,
            }
          );
          return reply.send({
            idempotent: true,
            result,
          });
        }

        case 'contract_get_source': {
          const result = await rpcClient.request(
            'GET',
            '/v2/contracts/source/{deployer_address}/{contract_name}',
            {
              deployer_address: parameters.deployer_address,
              contract_name: parameters.contract_name,
            }
          );
          return reply.send({
            idempotent: true,
            result,
          });
        }

        case 'contract_get_constant_val': {
          const result = await rpcClient.request(
            'GET',
            '/v2/constant_val/{deployer_address}/{contract_name}/{constant_name}',
            {
              deployer_address: parameters.deployer_address,
              contract_name: parameters.contract_name,
              constant_name: parameters.constant_name,
            }
          );
          return reply.send({
            idempotent: true,
            result: decodeClarityValue(result.data),
          });
        }

        case 'contract_get_data_var': {
          const result = await rpcClient.request(
            'GET',
            '/v2/data_var/{principal}/{contract_name}/{var_name}',
            {
              principal: parameters.deployer_address,
              contract_name: parameters.contract_name,
              var_name: parameters.var_name,
            }
          );
          return reply.send({
            idempotent: false,
            result: decodeClarityValue(result.data),
          });
        }

        case 'contract_get_map_entry': {
          const result = await rpcClient.request(
            'POST',
            '/v2/map_entry/{deployer_address}/{contract_name}/{map_name}',
            {
              deployer_address: parameters.deployer_address,
              contract_name: parameters.contract_name,
              map_name: parameters.map_name,
              key: parameters.key,
            }
          );
          return reply.send({
            idempotent: false,
            result: decodeClarityValue(result.data),
          });
        }

        default:
          return reply
            .status(500)
            .send(MeshErrors.invalidRequest(`Method ${method} is not implemented`));
      }
    }
  );
};
