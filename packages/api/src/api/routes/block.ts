import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { OnlineApiConfig } from '../index.js';
import {
  BlockRequestSchema,
  BlockResponseSchema,
  BlockTransactionRequestSchema,
  BlockTransactionResponseSchema,
  ErrorResponseSchema,
} from '@stacks/mesh-schemas';
import {
  serializeReplayedNakamotoBlock,
  serializeTransactionFromReplayedNakamotoBlock,
} from '../../serializers/index.js';
import {
  getParentBlockHash,
  getReplayedNakamotoBlockFromPartialBlockIdentifier,
} from '../../stacks-rpc/helpers.js';

export const BlockRoutes: FastifyPluginAsyncTypebox<OnlineApiConfig> = async (fastify, config) => {
  const { rpcClient } = config;

  fastify.post(
    '/block',
    {
      schema: {
        body: BlockRequestSchema,
        tags: ['Block'],
        response: {
          200: BlockResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { block_identifier } = request.body;
      const block = await getReplayedNakamotoBlockFromPartialBlockIdentifier(
        rpcClient,
        block_identifier,
        config.blockHashMode
      );
      // In block_hash mode the parent must be displayed as its block_hash, which the replay doesn't
      // carry — fetch it from the parent header (null for genesis, which has no parent block).
      const parentBlockHash =
        config.blockHashMode === 'block_hash'
          ? ((await getParentBlockHash(rpcClient, block.parent_block_id)) ?? undefined)
          : undefined;
      return reply.send({
        block: await serializeReplayedNakamotoBlock(block, config, parentBlockHash),
      });
    }
  );

  fastify.post(
    '/block/transaction',
    {
      schema: {
        body: BlockTransactionRequestSchema,
        tags: ['Block'],
        response: {
          200: BlockTransactionResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { block_identifier, transaction_identifier } = request.body;
      const block = await getReplayedNakamotoBlockFromPartialBlockIdentifier(
        rpcClient,
        block_identifier,
        config.blockHashMode
      );
      return reply.send({
        transaction: await serializeTransactionFromReplayedNakamotoBlock(
          block,
          transaction_identifier.hash,
          config
        ),
      });
    }
  );
};
