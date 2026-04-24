import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
import {
  AccountBalanceRequestSchema,
  AccountBalanceResponse,
  AccountBalanceResponseSchema,
  AccountCoinsRequestSchema,
  BlockIdentifier,
  ErrorResponseSchema,
} from '../../../../schemas/dist/index.js';
import { STX_CURRENCY } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';
import BigNumber from 'bignumber.js';
import {
  getChainTipNakamotoBlock,
  getNakamotoBlockFromPartialBlockIdentifier,
} from '../../stacks-rpc/helpers.js';
import { addHexPrefix } from '../../serializers/index.js';

export const AccountRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  const { rpcClient } = config;

  fastify.post(
    '/account/balance',
    {
      schema: {
        body: AccountBalanceRequestSchema,
        tags: ['Account'],
        response: {
          200: AccountBalanceResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { account_identifier, block_identifier } = request.body;

      // If the caller provides a block identifier, use it. Otherwise, use the chain tip.
      let tipIdentifier: BlockIdentifier | undefined;
      if (block_identifier) {
        const decodedBlock = await getNakamotoBlockFromPartialBlockIdentifier(
          rpcClient,
          block_identifier
        );
        if (decodedBlock) {
          tipIdentifier = {
            index: Number(decodedBlock.header.chain_length),
            hash: addHexPrefix(decodedBlock.header.index_block_hash),
          };
        }
      }
      if (!tipIdentifier) {
        const { decodedBlock } = await getChainTipNakamotoBlock(rpcClient);
        tipIdentifier = {
          index: Number(decodedBlock.header.chain_length),
          hash: addHexPrefix(decodedBlock.header.index_block_hash),
        };
      }

      // Get the account balance at the calculated block identifier.
      const accountInfo = await rpcClient.request('GET', '/v2/accounts/{principal}', {
        params: {
          path: { principal: account_identifier.address },
          query: { proof: 0, tip: tipIdentifier.hash },
        },
      });

      // Stacks core reports `balance` as the liquid balance, excluding locked balance.
      const balance = BigNumber(accountInfo.balance);
      // `locked` is the locked balance.
      const locked = BigNumber(accountInfo.locked);

      const isLockedSubAccount = account_identifier.sub_account?.address === 'locked';
      const reportedBalance = isLockedSubAccount ? locked : balance;

      const response: AccountBalanceResponse = {
        block_identifier: tipIdentifier,
        balances: [
          {
            value: reportedBalance.toString(),
            currency: STX_CURRENCY,
          },
        ],
        metadata: {
          nonce: accountInfo.nonce,
          locked_balance: locked.toString(),
          unlock_height: accountInfo.unlock_height,
        },
      };
      return reply.send(response);
    }
  );

  fastify.post(
    '/account/coins',
    {
      schema: {
        body: AccountCoinsRequestSchema,
        tags: ['Account'],
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
