import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { RouteConfig } from '../index.js';
import {
  ErrorResponseSchema,
  MempoolRequestSchema,
  MempoolTransactionRequestSchema,
} from '../../../../schemas/dist/index.js';
import { MeshErrors } from '../../utils/errors.js';

export const MempoolRoutes: FastifyPluginAsyncTypebox<RouteConfig> = async (
  fastify,
  _config
) => {
  fastify.post(
    '/mempool',
    {
      schema: {
        body: MempoolRequestSchema,
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
            '/mempool is not supported. The Stacks node does not provide a mempool listing endpoint.'
          )
        );
    }
  );

  fastify.post(
    '/mempool/transaction',
    {
      schema: {
        body: MempoolTransactionRequestSchema,
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
            '/mempool/transaction is not supported. The Stacks node does not provide mempool transaction lookup.'
          )
        );
    }
  );
};
