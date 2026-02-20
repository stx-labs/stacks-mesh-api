import { FastifyError, FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify';
import { MeshErrors } from '../../utils/errors.js';
import {
  StacksRpcBlockNotFoundError,
  StacksRpcTransactionNotFoundError,
} from '../../stacks-rpc/errors.js';

export const handleMeshError = (
  error: FastifyError,
  request: FastifyRequest<RouteGenericInterface>,
  reply: FastifyReply<RouteGenericInterface>
) => {
  if (error instanceof StacksRpcBlockNotFoundError) {
    return reply.status(500).send(MeshErrors.blockNotFound(error.message));
  }
  if (error instanceof StacksRpcTransactionNotFoundError) {
    return reply.status(500).send(MeshErrors.transactionNotFound(error.message));
  }
  if (error.validation) {
    return reply
      .status(500)
      .send(MeshErrors.invalidRequest(error.message, { validation: error.validation }));
  }
  request.log.error(error);
  return reply.status(500).send(MeshErrors.internalError(error.message));
};
