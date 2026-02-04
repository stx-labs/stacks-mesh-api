import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { StacksRpcClient } from '../../services/stacks-rpc-client.js';
import stacksEncoding from '@hirosystems/stacks-encoding-native-js';
import { MeshErrors } from '../../utils/errors.js';
import { validateNetwork } from '../../utils/validation.js';
import { StacksRpcError } from '../../services/stacks-rpc-client.js';
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
  StacksTransaction,
  TransactionIdentifier,
} from '@stacks/mesh-serializer';
import { serializeDecodedNakamotoBlock } from '../../utils/converter.js';
import { serializeDecodedTransaction } from '../../utils/converter.js';

export const blockRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (fastify, config) => {
  const { rpcClient, network } = config;

  // POST /block
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
      const { network_identifier, block_identifier } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      if (!block_identifier.hash && block_identifier.index === undefined) {
        return reply.status(500).send(MeshErrors.blockIdentifierRequired());
      }

      try {
        const block = await fetchAndParseBlock(rpcClient, block_identifier);

        const response: BlockResponse = {
          block,
        };

        return reply.send(response);
      } catch (error) {
        if (error instanceof BlockNotFoundError) {
          return reply
            .status(500)
            .send(
              MeshErrors.blockNotFound(block_identifier.hash ?? String(block_identifier.index))
            );
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Failed to fetch block');
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );

  // POST /block/transaction
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
      const { network_identifier, block_identifier, transaction_identifier } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        const transaction = await fetchBlockTransaction(
          rpcClient,
          block_identifier,
          transaction_identifier
        );

        const response: BlockTransactionResponse = {
          transaction,
        };

        return reply.send(response);
      } catch (error) {
        if (error instanceof TransactionNotFoundError) {
          return reply
            .status(500)
            .send(MeshErrors.transactionNotFound(transaction_identifier.hash));
        }
        if (error instanceof BlockNotFoundError) {
          return reply.status(500).send(MeshErrors.blockNotFound(block_identifier.hash));
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Failed to fetch block transaction');
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );
};

class BlockNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Block not found: ${identifier}`);
    this.name = 'BlockNotFoundError';
  }
}

class TransactionNotFoundError extends Error {
  constructor(hash: string) {
    super(`Transaction not found: ${hash}`);
    this.name = 'TransactionNotFoundError';
  }
}

async function fetchAndParseBlock(
  rpcClient: StacksRpcClient,
  blockIdentifier: BlockIdentifier
): Promise<Block> {
  try {
    let blockBytes: Buffer;

    if (blockIdentifier.index !== undefined) {
      // Fetch by height
      blockBytes = await rpcClient.getBlockByHeight(blockIdentifier.index);
    } else if (blockIdentifier.hash) {
      // Fetch by hash - remove 0x prefix if present for RPC call
      const hash = blockIdentifier.hash.startsWith('0x')
        ? blockIdentifier.hash.slice(2)
        : blockIdentifier.hash;
      blockBytes = await rpcClient.getBlockByHash(hash);
    } else {
      throw new Error('Block identifier must include hash or index');
    }

    // Decode the block binary
    const decodedBlock = stacksEncoding.decodeNakamotoBlock(blockBytes);

    // Fetch confirmed transaction data for each transaction in the block
    const confirmedTxDataMap = new Map<
      string,
      Awaited<ReturnType<typeof rpcClient.getConfirmedTransaction>>
    >();
    await Promise.all(
      decodedBlock.txs.map(async tx => {
        try {
          // Remove 0x prefix if present for RPC call
          const txId = tx.tx_id.startsWith('0x') ? tx.tx_id.slice(2) : tx.tx_id;
          const confirmedTxData = await rpcClient.getConfirmedTransaction(txId);
          confirmedTxDataMap.set(tx.tx_id, confirmedTxData);
        } catch (error) {
          // Log error but don't fail the whole block fetch
          console.error(`Failed to fetch confirmed transaction data for ${tx.tx_id}:`, error);
        }
      })
    );

    // The block height is in the header's chain_length field
    const blockHeight = Number(decodedBlock.header.chain_length);

    // Parent block hash is in the header
    const parentBlockHash = decodedBlock.header.parent_block_id;

    // Convert to Mesh format using the serializer package
    // Note: confirmedTxDataMap is available here if needed for future enhancements
    return serializeDecodedNakamotoBlock(decodedBlock);
  } catch (error) {
    if (error instanceof StacksRpcError && error.statusCode === 404) {
      throw new BlockNotFoundError(blockIdentifier.hash ?? String(blockIdentifier.index));
    }
    throw error;
  }
}

async function fetchBlockTransaction(
  rpcClient: StacksRpcClient,
  blockIdentifier: BlockIdentifier,
  txIdentifier: TransactionIdentifier
): Promise<StacksTransaction> {
  try {
    let blockBytes: Buffer;

    if (blockIdentifier.index !== undefined) {
      blockBytes = await rpcClient.getBlockByHeight(blockIdentifier.index);
    } else if (blockIdentifier.hash) {
      const hash = blockIdentifier.hash.startsWith('0x')
        ? blockIdentifier.hash.slice(2)
        : blockIdentifier.hash;
      blockBytes = await rpcClient.getBlockByHash(hash);
    } else {
      throw new Error('Block identifier must include hash or index');
    }

    // Decode the block
    const decodedBlock = stacksEncoding.decodeNakamotoBlock(blockBytes);

    // Normalize the transaction hash for comparison
    const targetTxId = txIdentifier.hash.toLowerCase();
    const targetTxIdWithPrefix = targetTxId.startsWith('0x') ? targetTxId : `0x${targetTxId}`;
    const targetTxIdWithoutPrefix = targetTxId.startsWith('0x') ? targetTxId.slice(2) : targetTxId;

    // Find the transaction in the block
    const decodedTx = decodedBlock.txs.find(tx => {
      const txId = tx.tx_id.toLowerCase();
      return txId === targetTxIdWithPrefix || txId === targetTxIdWithoutPrefix;
    });

    if (!decodedTx) {
      throw new TransactionNotFoundError(txIdentifier.hash);
    }

    // Convert to Mesh format using the serializer package
    return serializeDecodedTransaction(decodedTx, 0);
  } catch (error) {
    if (error instanceof StacksRpcError && error.statusCode === 404) {
      throw new BlockNotFoundError(blockIdentifier.hash ?? String(blockIdentifier.index));
    }
    if (error instanceof TransactionNotFoundError) {
      throw error;
    }
    throw error;
  }
}
