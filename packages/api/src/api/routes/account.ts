import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
import {
  AccountBalanceRequestSchema,
  AccountBalanceResponse,
  AccountBalanceResponseSchema,
  AccountCoinsRequestSchema,
  ErrorResponseSchema,
} from '../../../../schemas/dist/index.js';
import { STX_CURRENCY } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';

export const AccountRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
  const { rpcClient } = config;

  fastify.post(
    '/account/balance',
    {
      schema: {
        body: AccountBalanceRequestSchema,
        response: {
          200: AccountBalanceResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { account_identifier, block_identifier } = request.body;

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

      // // Add locked balance as sub-account if there is any
      // if (BigInt(locked) > 0n) {
      //   if (account_identifier.sub_account?.address === 'locked') {
      //     response.balances = [
      //       {
      //         value: locked,
      //         currency: STX_CURRENCY,
      //       },
      //     ];
      //   }
      // }

      return reply.send(response);
    }
  );

  fastify.post(
    '/account/coins',
    {
      schema: {
        body: AccountCoinsRequestSchema,
        response: {
          500: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply
        .status(500)
        .send(
          MeshErrors.notImplemented(
            '/account/coins is not supported for account-based blockchains. Use /account/balance instead.'
          )
        );
    }
  );
};
