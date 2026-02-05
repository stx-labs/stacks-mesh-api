import { ErrorResponse } from '@stacks/mesh-serializer';

// Mesh API standard error codes
export const ErrorCodes = {
  // Network errors (1xxx)
  NETWORK_NOT_SUPPORTED: 1,
  NETWORK_OPTIONS_ERROR: 2,
  NETWORK_STATUS_ERROR: 3,

  // Block errors (2xxx)
  BLOCK_NOT_FOUND: 100,
  BLOCK_IDENTIFIER_REQUIRED: 101,
  INVALID_BLOCK_IDENTIFIER: 102,

  // Transaction errors (3xxx)
  TRANSACTION_NOT_FOUND: 200,
  INVALID_TRANSACTION: 201,
  TRANSACTION_BROADCAST_ERROR: 202,
  TRANSACTION_PARSE_ERROR: 203,

  // Account errors (4xxx)
  ACCOUNT_NOT_FOUND: 300,
  INVALID_ACCOUNT_IDENTIFIER: 301,

  // Construction errors (5xxx)
  INVALID_PUBLIC_KEY: 400,
  INVALID_SIGNATURE: 401,
  INVALID_CURVE_TYPE: 402,
  CONSTRUCTION_METADATA_ERROR: 403,
  CONSTRUCTION_PAYLOADS_ERROR: 404,
  CONSTRUCTION_COMBINE_ERROR: 405,

  // Mempool errors (6xxx)
  MEMPOOL_TRANSACTION_NOT_FOUND: 500,

  // General errors (9xxx)
  INTERNAL_ERROR: 900,
  NOT_IMPLEMENTED: 901,
  INVALID_REQUEST: 902,
  RPC_ERROR: 903,
} as const;

export function createMeshError(
  code: number,
  message: string,
  retriable: boolean,
  description?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    code,
    message,
    retriable,
    description,
    details,
  };
}

// Pre-defined errors for common scenarios
export const MeshErrors = {
  networkNotSupported: (network: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.NETWORK_NOT_SUPPORTED,
      'Network not supported',
      false,
      `The network "${network}" is not supported by this implementation`
    ),

  blockNotFound: (identifier: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.BLOCK_NOT_FOUND,
      'Block not found',
      true,
      `Could not find block with identifier: ${identifier}`
    ),

  blockIdentifierRequired: (): ErrorResponse =>
    createMeshError(
      ErrorCodes.BLOCK_IDENTIFIER_REQUIRED,
      'Block identifier required',
      false,
      'Either block index or block hash must be provided'
    ),

  invalidBlockIdentifier: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INVALID_BLOCK_IDENTIFIER, 'Invalid block identifier', false, reason),

  transactionNotFound: (txHash: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.TRANSACTION_NOT_FOUND,
      'Transaction not found',
      true,
      `Could not find transaction with hash: ${txHash}`
    ),

  invalidTransaction: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INVALID_TRANSACTION, 'Invalid transaction', false, reason),

  transactionBroadcastError: (reason: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.TRANSACTION_BROADCAST_ERROR,
      'Transaction broadcast failed',
      true,
      reason
    ),

  accountNotFound: (address: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.ACCOUNT_NOT_FOUND,
      'Account not found',
      true,
      `Could not find account with address: ${address}`
    ),

  invalidAccountIdentifier: (reason: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.INVALID_ACCOUNT_IDENTIFIER,
      'Invalid account identifier',
      false,
      reason
    ),

  invalidPublicKey: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INVALID_PUBLIC_KEY, 'Invalid public key', false, reason),

  invalidSignature: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INVALID_SIGNATURE, 'Invalid signature', false, reason),

  mempoolTransactionNotFound: (txHash: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.MEMPOOL_TRANSACTION_NOT_FOUND,
      'Mempool transaction not found',
      true,
      `Could not find mempool transaction with hash: ${txHash}`
    ),

  internalError: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INTERNAL_ERROR, 'Internal error', true, reason),

  notImplemented: (feature: string): ErrorResponse =>
    createMeshError(
      ErrorCodes.NOT_IMPLEMENTED,
      'Not implemented',
      false,
      `The feature "${feature}" is not implemented`
    ),

  invalidRequest: (reason: string): ErrorResponse =>
    createMeshError(ErrorCodes.INVALID_REQUEST, 'Invalid request', false, reason),

  rpcError: (reason: string, details?: Record<string, unknown>): ErrorResponse =>
    createMeshError(ErrorCodes.RPC_ERROR, 'RPC error', true, reason, details),
};

// Get all defined errors for NetworkOptionsResponse
export function getAllErrors(): ErrorResponse[] {
  return [
    createMeshError(ErrorCodes.NETWORK_NOT_SUPPORTED, 'Network not supported', false),
    createMeshError(ErrorCodes.NETWORK_OPTIONS_ERROR, 'Network options error', true),
    createMeshError(ErrorCodes.NETWORK_STATUS_ERROR, 'Network status error', true),
    createMeshError(ErrorCodes.BLOCK_NOT_FOUND, 'Block not found', true),
    createMeshError(ErrorCodes.BLOCK_IDENTIFIER_REQUIRED, 'Block identifier required', false),
    createMeshError(ErrorCodes.INVALID_BLOCK_IDENTIFIER, 'Invalid block identifier', false),
    createMeshError(ErrorCodes.TRANSACTION_NOT_FOUND, 'Transaction not found', true),
    createMeshError(ErrorCodes.INVALID_TRANSACTION, 'Invalid transaction', false),
    createMeshError(ErrorCodes.TRANSACTION_BROADCAST_ERROR, 'Transaction broadcast failed', true),
    createMeshError(ErrorCodes.TRANSACTION_PARSE_ERROR, 'Transaction parse error', false),
    createMeshError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account not found', true),
    createMeshError(ErrorCodes.INVALID_ACCOUNT_IDENTIFIER, 'Invalid account identifier', false),
    createMeshError(ErrorCodes.INVALID_PUBLIC_KEY, 'Invalid public key', false),
    createMeshError(ErrorCodes.INVALID_SIGNATURE, 'Invalid signature', false),
    createMeshError(ErrorCodes.INVALID_CURVE_TYPE, 'Invalid curve type', false),
    createMeshError(ErrorCodes.CONSTRUCTION_METADATA_ERROR, 'Construction metadata error', true),
    createMeshError(ErrorCodes.CONSTRUCTION_PAYLOADS_ERROR, 'Construction payloads error', false),
    createMeshError(ErrorCodes.CONSTRUCTION_COMBINE_ERROR, 'Construction combine error', false),
    createMeshError(
      ErrorCodes.MEMPOOL_TRANSACTION_NOT_FOUND,
      'Mempool transaction not found',
      true
    ),
    createMeshError(ErrorCodes.INTERNAL_ERROR, 'Internal error', true),
    createMeshError(ErrorCodes.NOT_IMPLEMENTED, 'Not implemented', false),
    createMeshError(ErrorCodes.INVALID_REQUEST, 'Invalid request', false),
    createMeshError(ErrorCodes.RPC_ERROR, 'RPC error', true),
  ];
}
