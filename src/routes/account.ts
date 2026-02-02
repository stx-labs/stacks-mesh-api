import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { StacksRpcClient } from '../services/stacks-rpc.js';
import {
  AccountBalanceRequestSchema,
  AccountCoinsRequestSchema,
  AccountBalanceResponseSchema,
  AccountCoinsResponseSchema,
  MeshErrorSchema,
  type AccountBalanceResponse,
  type AccountCoinsResponse,
} from '../types/schemas.js';
import { STX_CURRENCY } from '../utils/constants.js';
import { MeshErrors } from '../utils/errors.js';
import { validateNetwork } from '../utils/validation.js';

export interface AccountRoutesConfig {
  rpcClient: StacksRpcClient;
  network: 'mainnet' | 'testnet';
}

export const accountRoutes: FastifyPluginAsyncTypebox<AccountRoutesConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // POST /account/balance
  fastify.post(
    '/account/balance',
    {
      schema: {
        body: AccountBalanceRequestSchema,
        response: {
          200: AccountBalanceResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, account_identifier, block_identifier } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        // Build tip parameter for historical queries
        const tip = block_identifier?.hash;

        // Fetch account data from Stacks RPC
        const [accountInfo, nodeInfo] = await Promise.all([
          rpcClient.getAccount(account_identifier.address, { tip }),
          rpcClient.getInfo(),
        ]);

        // Parse balance - Stacks returns balance as hex string
        const balance = BigInt(accountInfo.balance).toString();
        const locked = BigInt(accountInfo.locked).toString();

        // Determine current block identifier
        const currentBlockIdentifier = block_identifier?.hash
          ? {
              index: block_identifier.index ?? nodeInfo.stacks_tip_height,
              hash: block_identifier.hash,
            }
          : {
              index: nodeInfo.stacks_tip_height,
              hash: nodeInfo.stacks_tip,
            };

        const response: AccountBalanceResponse = {
          block_identifier: currentBlockIdentifier,
          balances: [
            {
              value: balance,
              currency: STX_CURRENCY,
            },
          ],
          metadata: {
            nonce: accountInfo.nonce,
            locked_balance: locked,
            unlock_height: accountInfo.unlock_height,
          },
        };

        // Add locked balance as sub-account if there is any
        if (BigInt(locked) > 0n) {
          if (account_identifier.sub_account?.address === 'locked') {
            response.balances = [
              {
                value: locked,
                currency: STX_CURRENCY,
              },
            ];
          }
        }

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a 404 error (account doesn't exist)
        if (message.includes('404')) {
          const nodeInfo = await rpcClient.getInfo();
          const response: AccountBalanceResponse = {
            block_identifier: {
              index: nodeInfo.stacks_tip_height,
              hash: nodeInfo.stacks_tip,
            },
            balances: [
              {
                value: '0',
                currency: STX_CURRENCY,
              },
            ],
            metadata: {
              nonce: 0,
              locked_balance: '0',
              unlock_height: 0,
            },
          };
          return reply.send(response);
        }

        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );

  // POST /account/coins
  fastify.post(
    '/account/coins',
    {
      schema: {
        body: AccountCoinsRequestSchema,
        response: {
          200: AccountCoinsResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        // Stacks is account-based, not UTXO-based
        const nodeInfo = await rpcClient.getInfo();

        const response: AccountCoinsResponse = {
          block_identifier: {
            index: nodeInfo.stacks_tip_height,
            hash: nodeInfo.stacks_tip,
          },
          coins: [],
          metadata: {
            note: 'Stacks is an account-based blockchain, not UTXO-based. Use /account/balance instead.',
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
