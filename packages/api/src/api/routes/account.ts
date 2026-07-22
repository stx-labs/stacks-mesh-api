import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { OnlineApiConfig } from '../index.js';
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
import { selectDisplayBlockHash } from '../../utils/block-hash.js';

export const AccountRoutes: FastifyPluginAsyncTypebox<OnlineApiConfig> = async (
  fastify,
  config
) => {
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

      // Resolve the target block: the caller's block identifier if given, otherwise the chain tip.
      let decodedBlock =
        (block_identifier &&
          (await getNakamotoBlockFromPartialBlockIdentifier(
            rpcClient,
            block_identifier,
            config.blockHashMode
          ))) ||
        undefined;
      if (!decodedBlock) {
        decodedBlock = (await getChainTipNakamotoBlock(rpcClient)).decodedBlock;
      }

      // The node's `tip` param always needs the index block hash, independent of display mode.
      const indexBlockHash = addHexPrefix(decodedBlock.header.index_block_hash);
      const tipIdentifier: BlockIdentifier = {
        index: Number(decodedBlock.header.chain_length),
        hash: selectDisplayBlockHash(config.blockHashMode, {
          indexBlockHash,
          blockHash: addHexPrefix(decodedBlock.header.block_hash),
        }),
      };

      // Get the account balance at the resolved block.
      const accountInfo = await rpcClient.request('GET', '/v2/accounts/{principal}', {
        params: {
          path: { principal: account_identifier.address },
          query: { proof: 0, tip: indexBlockHash },
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
