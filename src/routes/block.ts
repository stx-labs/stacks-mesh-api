import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { StacksRpcClient } from '../services/stacks-rpc.js';
import {
  BlockRequestSchema,
  BlockTransactionRequestSchema,
  BlockResponseSchema,
  BlockTransactionResponseSchema,
  MeshErrorSchema,
  type BlockRequest,
  type BlockTransactionRequest,
  type BlockResponse,
  type BlockTransactionResponse,
  type Block,
  type Transaction,
} from '../types/schemas.js';
import { MeshErrors } from '../utils/errors.js';
import { validateNetwork } from '../utils/validation.js';

export interface BlockRoutesConfig {
  rpcClient: StacksRpcClient;
  network: 'mainnet' | 'testnet';
}

export const blockRoutes: FastifyPluginAsyncTypebox<BlockRoutesConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // POST /block
  fastify.post(
    '/block',
    {
      schema: {
        body: BlockRequestSchema,
        response: {
          200: BlockResponseSchema,
          500: MeshErrorSchema,
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
          return reply.status(500).send(
            MeshErrors.blockNotFound(
              block_identifier.hash ?? String(block_identifier.index)
            )
          );
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
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
          500: MeshErrorSchema,
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
          return reply.status(500).send(
            MeshErrors.transactionNotFound(transaction_identifier.hash)
          );
        }
        if (error instanceof BlockNotFoundError) {
          return reply.status(500).send(
            MeshErrors.blockNotFound(block_identifier.hash)
          );
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
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
  _rpcClient: StacksRpcClient,
  blockIdentifier: BlockRequest['block_identifier']
): Promise<Block> {
  // TODO: Implement actual block fetching and parsing from Stacks RPC
  // This requires parsing the binary block format from /v3/blocks/{block_id}

  void _rpcClient;

  throw new BlockNotFoundError(
    blockIdentifier.hash ?? String(blockIdentifier.index)
  );
}

async function fetchBlockTransaction(
  _rpcClient: StacksRpcClient,
  blockIdentifier: BlockTransactionRequest['block_identifier'],
  txIdentifier: BlockTransactionRequest['transaction_identifier']
): Promise<Transaction> {
  // TODO: Implement actual transaction fetching within a block

  void _rpcClient;
  void blockIdentifier;

  throw new TransactionNotFoundError(txIdentifier.hash);
}
