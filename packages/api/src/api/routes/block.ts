import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { StacksRpcClient } from '../../stacks-rpc/stacks-rpc-client.js';
import stacksEncoding from '@hirosystems/stacks-encoding-native-js';
import { MeshErrors } from '../../utils/errors.js';
import { StacksRpcError } from '../../stacks-rpc/stacks-rpc-client.js';
import type { RouteConfig } from '../index.js';
import {
  BlockIdentifier,
  BlockRequestSchema,
  BlockResponse,
  BlockResponseSchema,
  BlockTransactionRequestSchema,
  BlockTransactionResponse,
  BlockTransactionResponseSchema,
  ErrorResponseSchema,
  Block,
  Transaction,
  TransactionIdentifier,
} from '@stacks/mesh-serializer';
import { removeHexPrefix, serializeReplayedNakamotoBlock } from '../../utils/converter.js';

export const BlockRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
  const { rpcClient, network } = config;

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
      const block = await fetchAndParseNakamotoBlock(rpcClient, block_identifier);
      if (!block) {
        return reply
          .status(500)
          .send(MeshErrors.blockNotFound(block_identifier.hash ?? String(block_identifier.index)));
      }
      const response: BlockResponse = {
        block,
      };
      return reply.send(response);
    }
  );

  // // POST /block/transaction
  // fastify.post(
  //   '/block/transaction',
  //   {
  //     schema: {
  //       body: BlockTransactionRequestSchema,
  //       response: {
  //         200: BlockTransactionResponseSchema,
  //         500: ErrorResponseSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     const { network_identifier, block_identifier, transaction_identifier } = request.body;

  //     const networkError = validateNetwork(network_identifier, network);
  //     if (networkError) {
  //       return reply.status(500).send(networkError);
  //     }

  //     try {
  //       const transaction = await fetchBlockTransaction(
  //         rpcClient,
  //         block_identifier,
  //         transaction_identifier
  //       );

  //       const response: BlockTransactionResponse = {
  //         transaction,
  //       };

  //       return reply.send(response);
  //     } catch (error) {
  //       if (error instanceof TransactionNotFoundError) {
  //         return reply
  //           .status(500)
  //           .send(MeshErrors.transactionNotFound(transaction_identifier.hash));
  //       }
  //       if (error instanceof BlockNotFoundError) {
  //         return reply.status(500).send(MeshErrors.blockNotFound(block_identifier.hash));
  //       }
  //       const message = error instanceof Error ? error.message : 'Unknown error';
  //       fastify.log.error({ error }, 'Failed to fetch block transaction');
  //       return reply.status(500).send(MeshErrors.rpcError(message));
  //     }
  //   }
  // );
};

class TransactionNotFoundError extends Error {
  constructor(hash: string) {
    super(`Transaction not found: ${hash}`);
    this.name = 'TransactionNotFoundError';
  }
}

async function fetchAndParseNakamotoBlock(
  rpcClient: StacksRpcClient,
  blockIdentifier: Partial<BlockIdentifier>
): Promise<Block | null> {
  try {
    // Fetch and decode block header
    let blockBytes: Buffer;
    if (blockIdentifier.index !== undefined) {
      blockBytes = await rpcClient.getNakamotoBlockByHeight(blockIdentifier.index);
    } else if (blockIdentifier.hash) {
      blockBytes = await rpcClient.getNakamotoBlockByHash(removeHexPrefix(blockIdentifier.hash));
    } else {
      return null;
    }
    const decodedBlock = stacksEncoding.decodeNakamotoBlock(blockBytes);
    // Replay and serialize full block
    const replay = await rpcClient.replayNakamotoBlock(
      removeHexPrefix(decodedBlock.header.index_block_hash)
    );
    return serializeReplayedNakamotoBlock(replay);
  } catch (error) {
    if (error instanceof StacksRpcError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// async function fetchBlockTransaction(
//   rpcClient: StacksRpcClient,
//   blockIdentifier: Partial<BlockIdentifier>,
//   txIdentifier: TransactionIdentifier
// ): Promise<Transaction> {
//   try {
//     let blockBytes: Buffer;

//     if (blockIdentifier.index !== undefined) {
//       blockBytes = await rpcClient.getNakamotoBlockByHeight(blockIdentifier.index);
//     } else if (blockIdentifier.hash) {
//       const hash = blockIdentifier.hash.startsWith('0x')
//         ? blockIdentifier.hash.slice(2)
//         : blockIdentifier.hash;
//       blockBytes = await rpcClient.getNakamotoBlockByHash(hash);
//     } else {
//       throw new Error('Block identifier must include hash or index');
//     }

//     // Decode the block
//     const decodedBlock = stacksEncoding.decodeNakamotoBlock(blockBytes);

//     // Normalize the transaction hash for comparison
//     const targetTxId = txIdentifier.hash.toLowerCase();
//     const targetTxIdWithPrefix = targetTxId.startsWith('0x') ? targetTxId : `0x${targetTxId}`;
//     const targetTxIdWithoutPrefix = targetTxId.startsWith('0x') ? targetTxId.slice(2) : targetTxId;

//     // Find the transaction in the block
//     const decodedTx = decodedBlock.txs.find(tx => {
//       const txId = tx.tx_id.toLowerCase();
//       return txId === targetTxIdWithPrefix || txId === targetTxIdWithoutPrefix;
//     });

//     if (!decodedTx) {
//       throw new TransactionNotFoundError(txIdentifier.hash);
//     }

//     // Convert to Mesh format using the serializer package
//     return serializeDecodedTransaction(decodedTx, 0);
//   } catch (error) {
//     if (error instanceof StacksRpcError && error.statusCode === 404) {
//       throw new BlockNotFoundError(blockIdentifier.hash ?? String(blockIdentifier.index));
//     }
//     if (error instanceof TransactionNotFoundError) {
//       throw error;
//     }
//     throw error;
//   }
// }
