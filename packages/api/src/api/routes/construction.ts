import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  ConstructionDeriveRequestSchema,
  ConstructionPreprocessRequestSchema,
  ConstructionMetadataRequestSchema,
  ConstructionPayloadsRequestSchema,
  ConstructionCombineRequestSchema,
  ConstructionParseRequestSchema,
  ConstructionHashRequestSchema,
  ConstructionSubmitRequestSchema,
  ConstructionDeriveResponseSchema,
  ConstructionPreprocessResponseSchema,
  ConstructionMetadataResponseSchema,
  ConstructionPayloadsResponseSchema,
  ConstructionCombineResponseSchema,
  ConstructionParseResponseSchema,
  TransactionIdentifierResponseSchema,
  MeshErrorSchema,
  type ConstructionDeriveResponse,
  type ConstructionPreprocessResponse,
  type ConstructionMetadataResponse,
  type TransactionIdentifierResponse,
} from '../../api/schemas.js';
import { STX_CURRENCY } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';
import { validateNetwork } from '../../utils/validation.js';
import type { RouteConfig } from '../index.js';

export const constructionRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // POST /construction/derive
  fastify.post(
    '/construction/derive',
    {
      schema: {
        body: ConstructionDeriveRequestSchema,
        response: {
          200: ConstructionDeriveResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, public_key } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      if (public_key.curve_type !== 'secp256k1') {
        return reply.status(500).send(
          MeshErrors.invalidPublicKey(
            `Unsupported curve type: ${public_key.curve_type}. Stacks only supports secp256k1.`
          )
        );
      }

      try {
        const address = deriveStacksAddress(public_key.hex_bytes, network);

        const response: ConstructionDeriveResponse = {
          account_identifier: {
            address,
          },
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.invalidPublicKey(message));
      }
    }
  );

  // POST /construction/preprocess
  fastify.post(
    '/construction/preprocess',
    {
      schema: {
        body: ConstructionPreprocessRequestSchema,
        response: {
          200: ConstructionPreprocessResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, operations } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        const senderAddresses = new Set<string>();
        const recipientAddresses = new Set<string>();

        for (const op of operations) {
          if (op.account?.address) {
            const value = BigInt(op.amount?.value ?? '0');
            if (value < 0n) {
              senderAddresses.add(op.account.address);
            } else if (value > 0n) {
              recipientAddresses.add(op.account.address);
            }
          }
        }

        const response: ConstructionPreprocessResponse = {
          options: {
            sender_addresses: Array.from(senderAddresses),
            recipient_addresses: Array.from(recipientAddresses),
            operation_count: operations.length,
          },
          required_public_keys: Array.from(senderAddresses).map((address) => ({
            address,
          })),
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.internalError(message));
      }
    }
  );

  // POST /construction/metadata
  fastify.post(
    '/construction/metadata',
    {
      schema: {
        body: ConstructionMetadataRequestSchema,
        response: {
          200: ConstructionMetadataResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, options } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        const senderAddresses = (options?.sender_addresses as string[]) ?? [];

        const accountInfos = await Promise.all(
          senderAddresses.map(async (address) => {
            try {
              const info = await rpcClient.getAccount(address);
              return { address, nonce: info.nonce, balance: info.balance };
            } catch {
              return { address, nonce: 0, balance: '0' };
            }
          })
        );

        const feeRate = await rpcClient.getTransferFee();

        const response: ConstructionMetadataResponse = {
          metadata: {
            account_info: accountInfos.reduce(
              (acc, info) => {
                acc[info.address] = { nonce: info.nonce, balance: info.balance };
                return acc;
              },
              {} as Record<string, { nonce: number; balance: string }>
            ),
            fee_rate: feeRate.fee,
            recent_block_hash: (await rpcClient.getInfo()).stacks_tip,
          },
          suggested_fee: [
            {
              value: String(feeRate.fee * 180),
              currency: STX_CURRENCY,
            },
          ],
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.rpcError(message));
      }
    }
  );

  // POST /construction/payloads
  fastify.post(
    '/construction/payloads',
    {
      schema: {
        body: ConstructionPayloadsRequestSchema,
        response: {
          200: ConstructionPayloadsResponseSchema,
          501: MeshErrorSchema,
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

      // TODO: Implement actual Stacks transaction construction
      return reply.status(501).send(
        MeshErrors.notImplemented('construction/payloads')
      );
    }
  );

  // POST /construction/combine
  fastify.post(
    '/construction/combine',
    {
      schema: {
        body: ConstructionCombineRequestSchema,
        response: {
          200: ConstructionCombineResponseSchema,
          501: MeshErrorSchema,
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

      // TODO: Implement signature combination
      return reply.status(501).send(
        MeshErrors.notImplemented('construction/combine')
      );
    }
  );

  // POST /construction/parse
  fastify.post(
    '/construction/parse',
    {
      schema: {
        body: ConstructionParseRequestSchema,
        response: {
          200: ConstructionParseResponseSchema,
          501: MeshErrorSchema,
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

      // TODO: Implement transaction parsing
      return reply.status(501).send(
        MeshErrors.notImplemented('construction/parse')
      );
    }
  );

  // POST /construction/hash
  fastify.post(
    '/construction/hash',
    {
      schema: {
        body: ConstructionHashRequestSchema,
        response: {
          200: TransactionIdentifierResponseSchema,
          501: MeshErrorSchema,
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

      // TODO: Implement transaction hash computation
      return reply.status(501).send(
        MeshErrors.notImplemented('construction/hash')
      );
    }
  );

  // POST /construction/submit
  fastify.post(
    '/construction/submit',
    {
      schema: {
        body: ConstructionSubmitRequestSchema,
        response: {
          200: TransactionIdentifierResponseSchema,
          500: MeshErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { network_identifier, signed_transaction } = request.body;

      const networkError = validateNetwork(network_identifier, network);
      if (networkError) {
        return reply.status(500).send(networkError);
      }

      try {
        const result = await rpcClient.broadcastTransaction(signed_transaction);

        if (result.error) {
          return reply.status(500).send(
            MeshErrors.transactionBroadcastError(
              `${result.reason}: ${JSON.stringify(result.reason_data)}`
            )
          );
        }

        const response: TransactionIdentifierResponse = {
          transaction_identifier: {
            hash: result.txid,
          },
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.transactionBroadcastError(message));
      }
    }
  );
};

function deriveStacksAddress(_publicKeyHex: string, _network: 'mainnet' | 'testnet'): string {
  // TODO: Implement using c32check encoding or @stacks/transactions library
  throw new Error('Address derivation not implemented - requires @stacks/transactions library');
}
