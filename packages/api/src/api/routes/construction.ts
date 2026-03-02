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
  serializePayload,
  AuthType,
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
  ConstructionPreprocessResponse,
  ConstructionMetadataResponse,
  ConstructionPayloadsResponse,
  ConstructionCombineResponse,
  ConstructionParseResponse,
  TransactionIdentifierResponse,
} from '@stacks/mesh-schemas';
import { STX_CURRENCY } from '../../utils/constants.js';
import { MeshErrors } from '../../utils/errors.js';
import {
  addHexPrefix,
  removeHexPrefix,
  serializeDecodedTransactionOperations,
} from '../../serializers/index.js';

export const ConstructionRoutes: FastifyPluginAsyncTypebox<ApiConfig> = async (
  fastify,
  config
) => {
  const { rpcClient, network } = config;

  // Derives a Stacks address from a public key.
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

      if (public_key.curve_type !== 'secp256k1') {
        return reply.status(500).send(
          MeshErrors.invalidPublicKey(
            `Unsupported curve type: ${public_key.curve_type}. Stacks only supports secp256k1.`
          )
        );
      }

      try {
        const address = getAddressFromPublicKey(
          removeHexPrefix(public_key.hex_bytes),
          network
        );
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

  // Analyzes operations to determine what metadata is needed for transaction construction.
  // Returns options to pass to /construction/metadata and lists required public keys.
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

      const senderAddresses = new Set<string>();
      const recipientAddresses = new Set<string>();

      for (const op of operations) {
        if ('account' in op && op.account?.address && 'amount' in op && op.amount?.value) {
          const value = BigInt(op.amount.value);
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
          ...(max_fee?.[0]?.value ? { max_fee: max_fee[0].value } : {}),
          ...(suggested_fee_multiplier ? { suggested_fee_multiplier } : {}),
        },
        required_public_keys: Array.from(senderAddresses).map(address => ({ address })),
      };
      return reply.send(response);
    }
  );

  // Fetches on-chain metadata needed for transaction construction: account nonces, fee estimates,
  // and the recent block hash.
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

      try {
        const senderAddresses: string[] = (options?.sender_addresses as string[]) ?? [];

        // Fetch account info (nonce, balance) for all sender addresses
        const accountInfos = await Promise.all(
          senderAddresses.map(async (address) => {
            try {
              const info = await rpcClient.getAccount(address);
              return { address, nonce: info.nonce, balance: BigInt(info.balance).toString() };
            } catch {
              return { address, nonce: 0, balance: '0' };
            }
          })
        );

        // Estimate fee using a representative STX transfer payload
        let suggestedFee = 200; // Default fallback fee in uSTX
        try {
          const dummyPubKey = public_keys?.[0]?.hex_bytes ?? '0'.repeat(66);
          const dummyRecipient = senderAddresses[0] ?? 'SP000000000000000000002Q6VF78';
          const dummyTx = await makeUnsignedSTXTokenTransfer({
            recipient: dummyRecipient,
            amount: 1,
            fee: 0,
            nonce: 0,
            publicKey: removeHexPrefix(dummyPubKey),
            network,
          });
          const payloadHex = serializePayload(dummyTx.payload);
          const feeEstimate = await rpcClient.estimateFee(removeHexPrefix(payloadHex));
          suggestedFee =
            feeEstimate.estimations[1]?.fee ??
            feeEstimate.estimations[0]?.fee ??
            suggestedFee;
        } catch {
          // Keep default fallback fee
        }

        // Cap fee if max_fee was specified in options
        const maxFee = options?.max_fee ? Number(options.max_fee) : undefined;
        if (maxFee !== undefined && suggestedFee > maxFee) {
          suggestedFee = maxFee;
        }

        // Apply fee multiplier if specified
        const feeMultiplier = options?.suggested_fee_multiplier
          ? Number(options.suggested_fee_multiplier)
          : undefined;
        if (feeMultiplier !== undefined) {
          suggestedFee = Math.round(suggestedFee * feeMultiplier);
        }

        const nodeInfo = await rpcClient.getInfo();

        const response: ConstructionMetadataResponse = {
          metadata: {
            account_info: accountInfos.reduce(
              (acc, info) => {
                acc[info.address] = { nonce: info.nonce, balance: info.balance };
                return acc;
              },
              {} as Record<string, { nonce: number; balance: string }>
            ),
            recent_block_hash: nodeInfo.stacks_tip,
          },
          suggested_fee: [
            {
              value: String(suggestedFee),
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
  // Builds an unsigned transaction from operations and metadata, returning the transaction hex
  // and the signing payload (sighash) that must be signed by the sender's private key.
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

      try {
        // Parse operations to extract transfer details
        let senderAddress: string | undefined;
        let recipientAddress: string | undefined;
        let transferAmount: bigint | undefined;
        let feeAmount: bigint | undefined;
        let memo: string | undefined;

        for (const op of operations) {
          if (op.type === 'token_transfer' && 'amount' in op && 'account' in op) {
            const value = BigInt(op.amount.value);
            if (value < 0n) {
              senderAddress = op.account.address;
              transferAmount = -value;
            } else if (value > 0n) {
              recipientAddress = op.account.address;
              if (!transferAmount) transferAmount = value;
            }
            if ('metadata' in op && op.metadata?.memo) {
              memo = op.metadata.memo;
            }
          } else if (op.type === 'fee' && 'amount' in op) {
            feeAmount = BigInt(op.amount.value);
            if (feeAmount < 0n) feeAmount = -feeAmount;
          }
        }

        if (!senderAddress || !recipientAddress || !transferAmount) {
          return reply.status(500).send(
            MeshErrors.invalidTransaction(
              'Operations must include token_transfer operations with a sender (negative amount) and recipient (positive amount)'
            )
          );
        }

        // Find the sender's public key by deriving addresses from each provided key
        const senderPubKey = public_keys?.find(pk => {
          try {
            const derivedAddress = getAddressFromPublicKey(
              removeHexPrefix(pk.hex_bytes),
              network
            );
            return derivedAddress === senderAddress;
          } catch {
            return false;
          }
        });

        if (!senderPubKey) {
          return reply.status(500).send(
            MeshErrors.invalidPublicKey(
              'No public key provided that matches the sender address'
            )
          );
        }

        // Read nonce from metadata
        const accountInfo = metadata?.account_info as
          | Record<string, { nonce: number; balance: string }>
          | undefined;
        const nonce = accountInfo?.[senderAddress]?.nonce ?? 0;

        // Determine fee: from operations, metadata suggested_fee, or default
        const fee = feeAmount ?? 0n;

        // Build the unsigned transaction
        const unsignedTx = await makeUnsignedSTXTokenTransfer({
          recipient: recipientAddress,
          amount: transferAmount,
          fee,
          nonce,
          publicKey: removeHexPrefix(senderPubKey.hex_bytes),
          network,
          memo,
        });

        const unsignedTxHex = serializeTransaction(unsignedTx);

        // Compute the signing payload (the sighash the signer must sign)
        const initialSighash = unsignedTx.signBegin();
        const sigHash = sigHashPreSign(
          initialSighash,
          AuthType.Standard,
          fee,
          BigInt(nonce)
        );

        const response: ConstructionPayloadsResponse = {
          unsigned_transaction: removeHexPrefix(unsignedTxHex),
          payloads: [
            {
              account_identifier: { address: senderAddress },
              address: senderAddress,
              hex_bytes: removeHexPrefix(sigHash),
              signature_type: 'ecdsa_recovery',
            },
          ],
        };

        return reply.send(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send(MeshErrors.internalError(message));
      }
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
            return reply.status(500).send(
              MeshErrors.invalidSignature(
                `Expected exactly 1 signature for single-sig transaction, got ${signatures.length}`
              )
            );
          }

          const sig = signatures[0];
          const signatureHex = removeHexPrefix(sig.hex_bytes);

          // Recoverable ECDSA signatures are 65 bytes (130 hex characters)
          if (signatureHex.length !== 130) {
            return reply.status(500).send(
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
              MeshErrors.notImplemented(
                'Multi-sig transaction combining is not yet supported'
              )
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
        const operations = serializeDecodedTransactionOperations(decodedTx);

        const response: ConstructionParseResponse = {
          operations,
          ...(signed
            ? { account_identifier_signers: [{ address: senderAddress }] }
            : {}),
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
          return reply.status(500).send(
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
