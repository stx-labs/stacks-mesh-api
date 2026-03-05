import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
import {
  CallRequestSchema,
  CallResponseSchema,
  ErrorResponseSchema,
} from '../../../../schemas/dist/index.js';
import { MeshErrors } from '../../utils/errors.js';
import { decodeClarityValue } from '../../serializers/index.js';

export const CallRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
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
            result: decodeClarityValue(callResult.result),
          });
        }

        case 'contract_get_interface': {
          const interfaceResult = await rpcClient.getContractInterface(
            parameters.deployer_address,
            parameters.contract_name
          );
          return reply.send({
            idempotent: true,
            result: interfaceResult as unknown as Record<string, unknown>,
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
            result: decodeClarityValue(constantValResult.data),
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
            result: decodeClarityValue(varData.data),
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
            result: decodeClarityValue(mapEntry.data),
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
