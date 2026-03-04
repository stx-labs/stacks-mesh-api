import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ApiConfig } from '../index.js';
import {
  getAddressFromPublicKey,
  makeUnsignedSTXTokenTransfer,
  deserializeTransaction,
  serializeTransaction,
  createMessageSignature,
  isSingleSig,
  sigHashPreSign,
  AuthType,
  serializePayloadBytes,
  makeUnsignedContractCall,
  hexToCV,
  makeUnsignedContractDeploy,
  StacksTransactionWire,
} from '@stacks/transactions';
import codec from '@stacks/codec';
import {
  ConstructionDeriveRequestSchema,
  ConstructionDeriveResponseSchema,
  ConstructionPreprocessRequestSchema,
  ConstructionPreprocessResponseSchema,
  ConstructionMetadataRequestSchema,
  ConstructionMetadataResponseSchema,
  ConstructionPayloadsRequestSchema,
  ConstructionPayloadsResponseSchema,
  ConstructionCombineRequestSchema,
  ConstructionCombineResponseSchema,
  ConstructionParseRequestSchema,
  ConstructionParseResponseSchema,
  ConstructionHashRequestSchema,
  ConstructionSubmitRequestSchema,
  TransactionIdentifierResponseSchema,
  ErrorResponseSchema,
} from '@stacks/mesh-schemas';
import type {
  ConstructionDeriveResponse,
  ConstructionPayloadsResponse,
  ConstructionCombineResponse,
  ConstructionParseResponse,
  TransactionIdentifierResponse,
  ConstructionOptions,
  ConstructionOperation,
} from '@stacks/mesh-schemas';
import { STX_CURRENCY } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';
import {
  addHexPrefix,
  removeHexPrefix,
  serializeDecodedTransactionOperations,
} from '../../serializers/index.js';
import BigNumber from 'bignumber.js';
import { isDeepStrictEqual } from 'node:util';

export const ConstructionRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (fastify, config) => {
  const { rpcClient, network } = config;

  fastify.post(
    '/construction/derive',
    {
      schema: {
        body: ConstructionDeriveRequestSchema,
        response: {
          200: ConstructionDeriveResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { public_key } = request.body;
      try {
        const address = getAddressFromPublicKey(removeHexPrefix(public_key.hex_bytes), network);
        const response: ConstructionDeriveResponse = {
          account_identifier: { address },
        };
        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.invalidPublicKey(message));
      }
    }
  );

  fastify.post(
    '/construction/preprocess',
    {
      schema: {
        body: ConstructionPreprocessRequestSchema,
        response: {
          200: ConstructionPreprocessResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { operations, max_fee, suggested_fee_multiplier } = request.body;
      try {
        const options = buildConstructionOptionsFromOperations({
          operations,
          allowFeeOperation: false,
          maxFee: max_fee?.[0]?.value,
          suggestedFeeMultiplier: suggested_fee_multiplier,
        });
        return reply.send({ options, required_public_keys: [{ address: options.sender_address }] });
      } catch (error) {
        return reply.status(500).send(MeshErrors.invalidTransaction((error as Error).message));
      }
    }
  );

  fastify.post(
    '/construction/metadata',
    {
      schema: {
        body: ConstructionMetadataRequestSchema,
        response: {
          200: ConstructionMetadataResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { options, public_keys } = request.body;

      // Estimate fee using a dummy transaction depending on the operation type specified in
      // options.
      //
      // TODO: Fees are currently estimated by transaction byte size because the Stacks node's fee
      // estimation endpoint does not yet return accurate values. We should switch back once that is
      // fixed.
      let suggestedFee = 200; // Default fallback fee in uSTX
      const dummyPubKey = removeHexPrefix(public_keys?.[0]?.hex_bytes ?? '0'.repeat(66));
      switch (options.type) {
        case 'token_transfer': {
          const dummyTx = await makeUnsignedSTXTokenTransfer({
            recipient: options.recipient_address,
            amount: 1,
            fee: 0,
            nonce: 0,
            publicKey: dummyPubKey,
            network,
          });
          suggestedFee = serializePayloadBytes(dummyTx.payload).length ?? suggestedFee;
          break;
        }
        case 'contract_call': {
          const [contractAddress, contractName] = options.contract_identifier.split('.');
          const dummyTx = await makeUnsignedContractCall({
            contractAddress,
            contractName,
            functionName: options.function_name,
            functionArgs: options.args.map(arg => hexToCV(arg)),
            publicKey: dummyPubKey,
            fee: 0,
          });
          suggestedFee = serializePayloadBytes(dummyTx.payload).length ?? suggestedFee;
          break;
        }
        case 'contract_deploy': {
          const dummyTx = await makeUnsignedContractDeploy({
            contractName: options.contract_name,
            codeBody: options.source_code,
            clarityVersion: options.clarity_version,
            publicKey: dummyPubKey,
            fee: 0,
          });
          suggestedFee = serializePayloadBytes(dummyTx.payload).length ?? suggestedFee;
          break;
        }
      }
      // Apply fee multiplier if specified
      const feeMultiplier = options?.suggested_fee_multiplier
        ? Number(options.suggested_fee_multiplier)
        : undefined;
      if (feeMultiplier !== undefined) {
        suggestedFee = Math.round(suggestedFee * feeMultiplier);
      }
      // Cap fee if max_fee was specified in options
      const maxFee = options?.max_fee ? Number(options.max_fee) : undefined;
      if (maxFee !== undefined && suggestedFee > maxFee) {
        suggestedFee = maxFee;
      }

      const senderInfo = await rpcClient.getAccount(options.sender_address);
      return reply.send({
        metadata: {
          options,
          sender_account_info: {
            nonce: senderInfo.nonce,
            balance: BigInt(senderInfo.balance).toString(),
          },
        },
        suggested_fee: [
          {
            value: String(suggestedFee),
            currency: STX_CURRENCY,
          },
        ],
      });
    }
  );

  fastify.post(
    '/construction/payloads',
    {
      schema: {
        body: ConstructionPayloadsRequestSchema,
        response: {
          200: ConstructionPayloadsResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { operations, metadata, public_keys } = request.body;

      // Build and validate construction options from operations.
      let options: ConstructionOptions;
      try {
        options = buildConstructionOptionsFromOperations({ operations, allowFeeOperation: true });
      } catch (error) {
        return reply.status(500).send(MeshErrors.invalidTransaction((error as Error).message));
      }
      if (!isDeepStrictEqual(options, metadata.options)) {
        return reply
          .status(500)
          .send(
            MeshErrors.invalidTransaction(
              'Options derived from operations do not match provided metadata options'
            )
          );
      }

      // Validate the sender address matches the public key.
      const derivedAddress = getAddressFromPublicKey(
        removeHexPrefix(public_keys[0].hex_bytes),
        network
      );
      if (derivedAddress !== options.sender_address) {
        return reply
          .status(500)
          .send(
            MeshErrors.invalidPublicKey('The provided public key does not match the sender address')
          );
      }

      // Extract the fee amount from operations.
      const feeOperation = operations.find(op => op.type === 'fee');
      if (!feeOperation) {
        return reply.status(500).send(MeshErrors.invalidTransaction('Fee operation is required'));
      }
      if (feeOperation.account.address !== options.sender_address) {
        return reply
          .status(500)
          .send(
            MeshErrors.invalidTransaction('Fee payer address does not match the sender address')
          );
      }
      const feeAmount = BigNumber(feeOperation.amount.value);
      if (feeAmount.gte(0)) {
        return reply.status(500).send(MeshErrors.invalidTransaction('Fee amount must be negative'));
      }
      const fee = feeAmount.abs().toString();

      // Construct the unsigned transaction.
      let unsignedTx: StacksTransactionWire;
      switch (options.type) {
        case 'token_transfer': {
          unsignedTx = await makeUnsignedSTXTokenTransfer({
            recipient: options.recipient_address,
            amount: options.amount,
            fee,
            nonce: metadata.sender_account_info.nonce,
            publicKey: public_keys[0].hex_bytes,
            network,
            memo: options.memo,
          });
          break;
        }
        case 'contract_call': {
          const [contractAddress, contractName] = options.contract_identifier.split('.');
          unsignedTx = await makeUnsignedContractCall({
            contractAddress,
            contractName,
            functionName: options.function_name,
            functionArgs: options.args.map(arg => hexToCV(arg)),
            publicKey: public_keys[0].hex_bytes,
            fee,
            network,
          });
          break;
        }
        case 'contract_deploy': {
          unsignedTx = await makeUnsignedContractDeploy({
            contractName: options.contract_name,
            codeBody: options.source_code,
            clarityVersion: options.clarity_version,
            publicKey: public_keys[0].hex_bytes,
            fee,
            network,
          });
          break;
        }
      }

      // Compute and return the signing payload.
      const initialSighash = unsignedTx.signBegin();
      const sigHash = sigHashPreSign(
        initialSighash,
        AuthType.Standard,
        fee,
        metadata.sender_account_info.nonce
      );
      return reply.send({
        unsigned_transaction: addHexPrefix(serializeTransaction(unsignedTx)),
        payloads: [
          {
            account_identifier: { address: options.sender_address },
            address: options.sender_address,
            hex_bytes: addHexPrefix(sigHash),
            signature_type: 'ecdsa_recovery',
          },
        ],
      });
    }
  );

  // POST /construction/combine
  // Combines an unsigned transaction with signatures to produce a signed transaction.
  // The client signs the payload from /payloads offline and provides the signature here.
  fastify.post(
    '/construction/combine',
    {
      schema: {
        body: ConstructionCombineRequestSchema,
        response: {
          200: ConstructionCombineResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { unsigned_transaction, signatures } = request.body;

      try {
        const tx = deserializeTransaction(removeHexPrefix(unsigned_transaction));

        if (signatures.length === 0) {
          return reply
            .status(500)
            .send(MeshErrors.invalidSignature('At least one signature is required'));
        }

        const spendingCondition = tx.auth.spendingCondition;

        if (isSingleSig(spendingCondition)) {
          if (signatures.length !== 1) {
            return reply
              .status(500)
              .send(
                MeshErrors.invalidSignature(
                  `Expected exactly 1 signature for single-sig transaction, got ${signatures.length}`
                )
              );
          }

          const sig = signatures[0];
          const signatureHex = removeHexPrefix(sig.hex_bytes);

          // Recoverable ECDSA signatures are 65 bytes (130 hex characters)
          if (signatureHex.length !== 130) {
            return reply
              .status(500)
              .send(
                MeshErrors.invalidSignature(
                  `Invalid signature length: expected 130 hex characters (65 bytes), got ${signatureHex.length}`
                )
              );
          }

          spendingCondition.signature = createMessageSignature(signatureHex);
        } else {
          // TODO: Multi-sig transaction combining
          return reply
            .status(500)
            .send(
              MeshErrors.notImplemented('Multi-sig transaction combining is not yet supported')
            );
        }

        const signedTxHex = serializeTransaction(tx);

        const response: ConstructionCombineResponse = {
          signed_transaction: removeHexPrefix(signedTxHex),
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.invalidTransaction(message));
      }
    }
  );

  // POST /construction/parse
  // Parses a transaction (signed or unsigned) and extracts its operations.
  // Used to verify a transaction matches the intended operations before signing or broadcasting.
  fastify.post(
    '/construction/parse',
    {
      schema: {
        body: ConstructionParseRequestSchema,
        response: {
          200: ConstructionParseResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { signed, transaction } = request.body;

      try {
        const txHex = removeHexPrefix(transaction);
        const decodedTx = codec.decodeTransaction(txHex);
        const senderAddress = decodedTx.auth.origin_condition.signer.address;
        const operations = await serializeDecodedTransactionOperations(decodedTx, config);

        const response: ConstructionParseResponse = {
          operations,
          ...(signed ? { account_identifier_signers: [{ address: senderAddress }] } : {}),
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.invalidTransaction(message));
      }
    }
  );

  // POST /construction/hash
  // Computes the transaction hash (txid) from a signed transaction.
  fastify.post(
    '/construction/hash',
    {
      schema: {
        body: ConstructionHashRequestSchema,
        response: {
          200: TransactionIdentifierResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { signed_transaction } = request.body;

      try {
        const tx = deserializeTransaction(removeHexPrefix(signed_transaction));
        const txid = tx.txid();

        const response: TransactionIdentifierResponse = {
          transaction_identifier: {
            hash: addHexPrefix(txid),
          },
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.invalidTransaction(message));
      }
    }
  );

  // POST /construction/submit
  // Broadcasts a signed transaction to the Stacks network.
  // This is one of two ONLINE endpoints (along with /metadata).
  fastify.post(
    '/construction/submit',
    {
      schema: {
        body: ConstructionSubmitRequestSchema,
        response: {
          200: TransactionIdentifierResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { signed_transaction } = request.body;

      try {
        const result = await rpcClient.broadcastTransaction(signed_transaction);

        if (result.error) {
          return reply
            .status(500)
            .send(
              MeshErrors.transactionBroadcastError(
                `${result.reason}: ${JSON.stringify(result.reason_data)}`
              )
            );
        }

        const response: TransactionIdentifierResponse = {
          transaction_identifier: {
            hash: addHexPrefix(result.txid),
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

function buildConstructionOptionsFromOperations(args: {
  operations: ConstructionOperation[];
  allowFeeOperation?: boolean;
  maxFee?: string;
  suggestedFeeMultiplier?: number;
}): ConstructionOptions {
  const { operations, allowFeeOperation = false, maxFee, suggestedFeeMultiplier } = args;
  const maxFeeObject = maxFee ? { max_fee: maxFee } : undefined;
  const suggestedFeeMultiplierObject = suggestedFeeMultiplier
    ? { suggested_fee_multiplier: suggestedFeeMultiplier }
    : undefined;

  const feeOperation = operations.find(op => op.type === 'fee');
  if (feeOperation && !allowFeeOperation) {
    throw new Error('Fee operation is not allowed at this stage');
  }
  const filteredOperations = operations.filter(op => op.type !== 'fee');

  // `contract_call` and `contract_deploy` are the only valid single operation types.
  // `token_transfer` requires two operations: one with a negative amount and one with a
  // positive amount. Other operation types are not allowed.
  switch (filteredOperations.length) {
    case 1: {
      const op = filteredOperations[0];
      switch (op.type) {
        case 'contract_call': {
          return {
            type: 'contract_call',
            sender_address: op.account.address,
            contract_identifier: op.metadata.contract_identifier,
            function_name: op.metadata.function_name,
            args: op.metadata.args,
            ...maxFeeObject,
            ...suggestedFeeMultiplierObject,
          };
        }
        case 'contract_deploy': {
          return {
            type: 'contract_deploy',
            sender_address: op.account.address,
            contract_name: op.metadata.contract_name,
            clarity_version: op.metadata.clarity_version,
            source_code: op.metadata.source_code,
            ...maxFeeObject,
            ...suggestedFeeMultiplierObject,
          };
        }
        default:
          throw new Error('Token transfers require two operations');
      }
    }
    case 2: {
      const [op1, op2] = filteredOperations;
      if (op1.type !== 'token_transfer' || op2.type !== 'token_transfer') {
        throw new Error('Token transfer operations cannot be combined with other operations');
      }
      let senderAddress: string | undefined;
      let recipientAddress: string | undefined;
      const value1 = BigNumber(op1.amount.value);
      const value2 = BigNumber(op2.amount.value);
      if (!value1.abs().eq(value2.abs())) {
        throw new Error('Token transfer operations require the same amount');
      }
      if (
        (value1.lt(0) && value2.lt(0)) ||
        (value1.gt(0) && value2.gt(0)) ||
        value1.eq(0) ||
        value2.eq(0)
      ) {
        throw new Error('Token transfers require one negative and one positive amount');
      }
      const memo1 = op1.metadata?.memo ?? undefined;
      const memo2 = op2.metadata?.memo ?? undefined;
      if (memo1 !== memo2) {
        throw new Error('Token transfer operations require the same memo');
      }
      if (value1.lt(0)) {
        senderAddress = op1.account.address;
        recipientAddress = op2.account.address;
      } else {
        senderAddress = op2.account.address;
        recipientAddress = op1.account.address;
      }
      return {
        type: 'token_transfer',
        sender_address: senderAddress,
        recipient_address: recipientAddress,
        amount: value1.abs().toString(),
        memo: memo1,
        ...maxFeeObject,
        ...suggestedFeeMultiplierObject,
      };
    }
    default:
      throw new Error('Invalid operation count: must be 1 or 2');
  }
}
