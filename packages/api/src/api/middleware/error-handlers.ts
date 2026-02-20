import { FastifyError, FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify';
import { MeshErrors } from '../../utils/errors.js';
import { StacksRpcBlockNotFoundError, StacksRpcTransactionNotFoundError } from '../../stacks-rpc/errors.js';

export const handleMeshError = (
  error: FastifyError,
  request: FastifyRequest<RouteGenericInterface>,
  reply: FastifyReply<RouteGenericInterface>
) => {
  request.log.error(error);
  if (error instanceof StacksRpcBlockNotFoundError) {
    return reply.status(500).send(MeshErrors.blockNotFound(error.message));
  }
  if (error instanceof StacksRpcTransactionNotFoundError) {
    return reply.status(500).send(MeshErrors.transactionNotFound(error.message));
  }
  if (error.validation) {
    // TODO: See if we can use MeshErrors.invalidRequest instead
    return reply.status(500).send({
      code: 902,
      message: 'Invalid request',
      retriable: false,
      description: error.message,
      details: {
        validation: error.validation,
      },
    });
  }
  return reply.status(500).send(MeshErrors.internalError(error.message));
};
