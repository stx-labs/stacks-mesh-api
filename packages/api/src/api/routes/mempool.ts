import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';

export const MempoolRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // // POST /mempool
  // fastify.post(
  //   '/mempool',
  //   {
  //     schema: {
  //       body: NetworkRequestSchema,
  //       response: {
  //         200: MempoolResponseSchema,
  //         500: MeshErrorSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     const networkError = validateNetwork(request.body.network_identifier, network);
  //     if (networkError) {
  //       return reply.status(500).send(networkError);
  //     }

  //     try {
  //       // Note: The Stacks core RPC doesn't provide a "list all mempool txs" endpoint
  //       // You would typically need to use the Stacks API or maintain your own mempool state
  //       const response: MempoolResponse = {
  //         transaction_identifiers: [],
  //       };

  //       return reply.send(response);
  //     } catch (error) {
  //       const message = error instanceof Error ? error.message : 'Unknown error';
  //       return reply.status(500).send(MeshErrors.rpcError(message));
  //     }
  //   }
  // );

  // // POST /mempool/transaction
  // fastify.post(
  //   '/mempool/transaction',
  //   {
  //     schema: {
  //       body: MempoolTransactionRequestSchema,
  //       response: {
  //         200: MempoolTransactionResponseSchema,
  //         500: MeshErrorSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     const { network_identifier, transaction_identifier } = request.body;

  //     const networkError = validateNetwork(network_identifier, network);
  //     if (networkError) {
  //       return reply.status(500).send(networkError);
  //     }

  //     try {
  //       const txData = await rpcClient.getUnconfirmedTransaction(
  //         transaction_identifier.hash
  //       );

  //       if (!txData) {
  //         return reply.status(500).send(
  //           MeshErrors.mempoolTransactionNotFound(transaction_identifier.hash)
  //         );
  //       }

  //       const transaction = convertStacksTxToMeshTx(txData, transaction_identifier.hash);

  //       const response: MempoolTransactionResponse = {
  //         transaction,
  //         metadata: {
  //           raw_tx: txData,
  //         },
  //       };

  //       return reply.send(response);
  //     } catch (error) {
  //       const message = error instanceof Error ? error.message : 'Unknown error';

  //       if (message.includes('404') || message.includes('not found')) {
  //         return reply.status(500).send(
  //           MeshErrors.mempoolTransactionNotFound(transaction_identifier.hash)
  //         );
  //       }

  //       return reply.status(500).send(MeshErrors.rpcError(message));
  //     }
  //   }
  // );
};
