import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { StacksRpcClient } from '../../stacks-rpc/stacks-rpc-client.js';
import codec from '@stacks/codec';
import type { ApiConfig } from '../index.js';
import {
  BlockIdentifier,
  BlockRequestSchema,
  BlockResponseSchema,
  BlockTransactionRequestSchema,
  BlockTransactionResponseSchema,
  ErrorResponseSchema,
} from '@stacks/mesh-schemas';
import {
  MeshSerializationConfig,
  removeHexPrefix,
  serializeReplayedNakamotoBlock,
  serializeTransactionFromReplayedNakamotoBlock,
} from '../../serializers/index.js';
import { StacksBlockReplay } from '../../stacks-rpc/types.js';

export const BlockRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  const { rpcClient, tokenMetadataCache, contractAbiCache, network } = config;

  fastify.post(
    '/block',
    {
      schema: {
        body: BlockRequestSchema,
        response: {
          200: BlockResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { block_identifier } = request.body;
      const block = await fetchReplayedNakamotoBlock(rpcClient, block_identifier);
      const config: MeshSerializationConfig = {
        tokenMetadataCache,
        contractAbiCache,
        network,
      };
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
        response: {
          200: BlockTransactionResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { block_identifier, transaction_identifier } = request.body;
      const block = await fetchReplayedNakamotoBlock(rpcClient, block_identifier);
      const config: MeshSerializationConfig = {
        tokenMetadataCache,
        contractAbiCache,
        network,
      };
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

async function fetchReplayedNakamotoBlock(
  rpcClient: StacksRpcClient,
  blockIdentifier: Partial<BlockIdentifier>
): Promise<StacksBlockReplay> {
  let indexBlockHash = blockIdentifier.hash;
  // If the block identifier is a height, fetch and decode the block header to get the index block
  // hash.
  if (!indexBlockHash) {
    const blockBytes = await rpcClient.getNakamotoBlockByHeight(blockIdentifier.index!);
    const decodedBlock = codec.decodeNakamotoBlock(blockBytes);
    indexBlockHash = decodedBlock.header.index_block_hash;
  }
  // Replay block
  return await rpcClient.replayNakamotoBlock(removeHexPrefix(indexBlockHash));
}
