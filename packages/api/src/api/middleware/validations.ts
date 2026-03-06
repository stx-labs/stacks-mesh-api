import {
  BlockIdentifier,
  ErrorResponse,
  NetworkIdentifier,
} from '../../../../schemas/dist/index.js';
import { MeshErrors } from '../../utils/errors.js';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiConfig } from '../index.js';

/**
 * Validates that the network identifier from the request matches the configured network
 * @param networkIdentifier - The network identifier from the request
 * @param configNetwork - The network from the RouteConfig
 * @returns ErrorResponse if validation fails, undefined if validation succeeds
 */
export function validateNetwork(
  networkIdentifier: NetworkIdentifier,
  configNetwork: 'mainnet' | 'testnet'
): ErrorResponse | undefined {
  if (networkIdentifier.blockchain !== 'stacks') {
    return MeshErrors.networkNotSupported(networkIdentifier.blockchain);
  }
  if (networkIdentifier.network !== configNetwork) {
    return MeshErrors.networkNotSupported(
      `${networkIdentifier.blockchain}/${networkIdentifier.network} (expected stacks/${configNetwork})`
    );
  }
  return undefined;
}

export const validateMeshRequest = (config: ApiConfig) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    if ('network_identifier' in body) {
      const networkError = validateNetwork(
        body.network_identifier as NetworkIdentifier,
        config.network
      );
      if (networkError) {
        return reply.status(500).send(networkError);
      }
    }
    if ('block_identifier' in body) {
      const blockIdentifier = body.block_identifier as Partial<BlockIdentifier>;
      if (!blockIdentifier.index && !blockIdentifier.hash) {
        return reply.status(500).send(MeshErrors.blockIdentifierRequired());
      }
    }
  };
};
