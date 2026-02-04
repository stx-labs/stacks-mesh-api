import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CallRequestSchema,
  CallResponseSchema,
  MeshErrorSchema,
  type CallResponse,
} from '../../api/schemas.js';
import { CALL_METHODS } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';
import { validateNetwork } from '../../utils/validation.js';
import type { RouteConfig } from '../index.js';

export const callRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // POST /call
  fastify.post(
    '/call',
    {
      schema: {
        body: CallRequestSchema,
        response: {
          200: CallResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, method, parameters } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      if (!CALL_METHODS.includes(method as (typeof CALL_METHODS)[number])) {
        return reply.status(500).send(
          MeshErrors.invalidRequest(
            `Unknown method: ${method}. Supported methods: ${CALL_METHODS.join(', ')}`
          )
        );
      }

      try {
        let result: Record<string, unknown>;
        let idempotent = true;

        switch (method) {
          case 'get_stx_balance': {
            const address = parameters.address as string;
            if (!address) {
              return reply.status(500).send(
                MeshErrors.invalidRequest('address parameter is required')
              );
            }
            const accountInfo = await rpcClient.getAccount(address);
            result = {
              balance: accountInfo.balance,
              locked: accountInfo.locked,
              unlock_height: accountInfo.unlock_height,
            };
            break;
          }

          case 'get_nonce': {
            const address = parameters.address as string;
            if (!address) {
              return reply.status(500).send(
                MeshErrors.invalidRequest('address parameter is required')
              );
            }
            const accountInfo = await rpcClient.getAccount(address);
            result = {
              nonce: accountInfo.nonce,
            };
            break;
          }

          case 'get_contract_info': {
            const contractAddress = parameters.contract_address as string;
            const contractName = parameters.contract_name as string;
            if (!contractAddress || !contractName) {
              return reply.status(500).send(
                MeshErrors.invalidRequest(
                  'contract_address and contract_name parameters are required'
                )
              );
            }
            const [contractInterface, contractSource] = await Promise.all([
              rpcClient.getContractInterface(contractAddress, contractName),
              rpcClient.getContractSource(contractAddress, contractName),
            ]);
            result = {
              interface: contractInterface,
              source: contractSource.source,
              publish_height: contractSource.publish_height,
            };
            break;
          }

          case 'call_read_only_function': {
            const contractAddress = parameters.contract_address as string;
            const contractName = parameters.contract_name as string;
            const functionName = parameters.function_name as string;
            const functionArgs = (parameters.function_args as string[]) ?? [];
            const senderAddress = (parameters.sender_address as string) ?? contractAddress;

            if (!contractAddress || !contractName || !functionName) {
              return reply.status(500).send(
                MeshErrors.invalidRequest(
                  'contract_address, contract_name, and function_name parameters are required'
                )
              );
            }

            const callResult = await rpcClient.callReadOnlyFunction(
              contractAddress,
              contractName,
              functionName,
              functionArgs,
              senderAddress
            );
            result = {
              okay: callResult.okay,
              result: callResult.result,
              cause: callResult.cause,
            };
            break;
          }

          case 'get_data_var': {
            const principal = parameters.principal as string;
            const contractName = parameters.contract_name as string;
            const varName = parameters.var_name as string;

            if (!principal || !contractName || !varName) {
              return reply.status(500).send(
                MeshErrors.invalidRequest(
                  'principal, contract_name, and var_name parameters are required'
                )
              );
            }

            const varData = await rpcClient.getDataVar(principal, contractName, varName);
            result = {
              data: varData.data,
            };
            break;
          }

          case 'get_map_entry': {
            const contractAddress = parameters.contract_address as string;
            const contractName = parameters.contract_name as string;
            const mapName = parameters.map_name as string;
            const key = parameters.key as string;

            if (!contractAddress || !contractName || !mapName || !key) {
              return reply.status(500).send(
                MeshErrors.invalidRequest(
                  'contract_address, contract_name, map_name, and key parameters are required'
                )
              );
            }

            const mapEntry = await rpcClient.getMapEntry(
              contractAddress,
              contractName,
              mapName,
              key
            );
            result = {
              data: mapEntry.data,
            };
            break;
          }

          case 'get_pox_info': {
            const poxInfo = await rpcClient.getPoxInfo();
            result = {
              contract_id: poxInfo.contract_id,
              current_cycle: poxInfo.current_cycle,
              next_cycle: poxInfo.next_cycle,
              min_amount_ustx: poxInfo.min_amount_ustx,
              reward_cycle_length: poxInfo.reward_cycle_length,
            };
            break;
          }

          case 'estimate_fee': {
            const transactionPayload = parameters.transaction_payload as string;
            if (!transactionPayload) {
              const transferFee = await rpcClient.getTransferFee();
              result = {
                fee_rate: transferFee.fee,
                estimated_fee: transferFee.fee * 180,
              };
            } else {
              const feeEstimate = await rpcClient.estimateFee(transactionPayload);
              result = {
                estimated_cost: feeEstimate.estimated_cost,
                estimated_cost_scalar: feeEstimate.estimated_cost_scalar,
                estimations: feeEstimate.estimations,
              };
            }
            idempotent = false;
            break;
          }

          default:
            return reply.status(500).send(
              MeshErrors.invalidRequest(`Method ${method} is not implemented`)
            );
        }

        const response: CallResponse = {
          result,
          idempotent,
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );
};
