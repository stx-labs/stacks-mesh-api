import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
import {
  CallRequestSchema,
  CallResponseSchema,
  ErrorResponseSchema,
} from '@stacks/mesh-serializer';
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
          if (callResult.okay) {
            return reply.send({
              idempotent: false,
              result: {
                okay: true,
                result: callResult.result,
              },
            });
          } else {
            return reply.send({
              idempotent: false,
              result: {
                okay: false,
                cause: callResult.cause,
              },
            });
          }
        }

        // case 'contract_get_data_var': {
        //   const principal = parameters.principal as string;
        //   const contractName = parameters.contract_name as string;
        //   const varName = parameters.var_name as string;

        //   if (!principal || !contractName || !varName) {
        //     return reply
        //       .status(500)
        //       .send(
        //         MeshErrors.invalidRequest(
        //           'principal, contract_name, and var_name parameters are required'
        //         )
        //       );
        //   }

        //   const varData = await rpcClient.getDataVar(principal, contractName, varName);
        //   result = {
        //     data: varData.data,
        //   };
        //   break;
        // }

        // case 'contract_get_map_entry': {
        //   const contractAddress = parameters.contract_address as string;
        //   const contractName = parameters.contract_name as string;
        //   const mapName = parameters.map_name as string;
        //   const key = parameters.key as string;

        //   if (!contractAddress || !contractName || !mapName || !key) {
        //     return reply
        //       .status(500)
        //       .send(
        //         MeshErrors.invalidRequest(
        //           'contract_address, contract_name, map_name, and key parameters are required'
        //         )
        //       );
        //   }

        //   const mapEntry = await rpcClient.getMapEntry(
        //     contractAddress,
        //     contractName,
        //     mapName,
        //     key
        //   );
        //   result = {
        //     data: mapEntry.data,
        //   };
        //   break;
        // }

        // case 'estimate_fee': {
        //   const transactionPayload = parameters.transaction_payload as string;
        //   if (!transactionPayload) {
        //     const transferFee = await rpcClient.getTransferFee();
        //     result = {
        //       fee_rate: transferFee.fee,
        //       estimated_fee: transferFee.fee * 180,
        //     };
        //   } else {
        //     const feeEstimate = await rpcClient.estimateFee(transactionPayload);
        //     result = {
        //       estimated_cost: feeEstimate.estimated_cost,
        //       estimated_cost_scalar: feeEstimate.estimated_cost_scalar,
        //       estimations: feeEstimate.estimations,
        //     };
        //   }
        //   idempotent = false;
        //   break;
        // }

        default:
          return reply
            .status(500)
            .send(MeshErrors.invalidRequest(`Method ${method} is not implemented`));
      }
    }
  );
};
