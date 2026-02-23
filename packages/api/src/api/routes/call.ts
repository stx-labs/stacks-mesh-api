import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
import {
  CallRequestSchema,
  CallResponseSchema,
  ErrorResponseSchema,
} from '../../../../schemas/dist/index.js';
import { MeshErrors } from '../../utils/errors.js';

export const CallRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
  const { rpcClient } = config;

  fastify.post(
    '/call',
    {
      schema: {
        body: CallRequestSchema,
        response: {
          200: CallResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { method, parameters } = request.body;

      // TODO: Decode clarity values
      switch (method) {
        case 'contract_call_read_only': {
          const callResult = await rpcClient.callReadOnlyFunction(
            parameters.deployer_address,
            parameters.contract_name,
            parameters.function_name,
            parameters.arguments,
            parameters.sender,
            parameters.sponsor
          );
          return reply.send({
            idempotent: false,
            result: {
              okay: true,
              result: callResult.result,
            },
          });
        }

        case 'contract_get_interface': {
          const interfaceResult = await rpcClient.getContractInterface(
            parameters.deployer_address,
            parameters.contract_name
          );
          return reply.send({
            idempotent: true,
            result: interfaceResult,
          });
        }

        case 'contract_get_source': {
          const sourceResult = await rpcClient.getContractSource(
            parameters.deployer_address,
            parameters.contract_name
          );
          return reply.send({
            idempotent: true,
            result: sourceResult,
          });
        }

        case 'contract_get_constant_val': {
          const constantValResult = await rpcClient.getContractConstantVal(
            parameters.deployer_address,
            parameters.contract_name,
            parameters.constant_name
          );
          return reply.send({
            idempotent: true,
            result: {
              okay: true,
              result: constantValResult,
            },
          });
        }

        case 'contract_get_data_var': {
          const varData = await rpcClient.getContractDataVar(
            parameters.deployer_address,
            parameters.contract_name,
            parameters.var_name
          );
          return reply.send({
            idempotent: false,
            result: {
              okay: true,
              result: varData,
            },
          });
        }

        case 'contract_get_map_entry': {
          const mapEntry = await rpcClient.getMapEntry(
            parameters.deployer_address,
            parameters.contract_name,
            parameters.map_name,
            parameters.key
          );
          return reply.send({
            idempotent: false,
            result: {
              okay: true,
              result: mapEntry,
            },
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
