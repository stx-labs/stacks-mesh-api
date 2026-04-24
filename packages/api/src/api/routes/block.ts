import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
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
import { getReplayedNakamotoBlockFromPartialBlockIdentifier } from '../../stacks-rpc/helpers.js';

export const BlockRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
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
        block_identifier
      );
      return reply.send({
        block: await serializeReplayedNakamotoBlock(block, config),
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
        block_identifier
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
