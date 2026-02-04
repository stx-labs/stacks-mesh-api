import type { Block, Transaction, Operation, Currency } from './types.js';
import stacksEncoding from '@hirosystems/stacks-encoding-native-js';
import type {
  DecodedNakamotoBlockResult,
  DecodedTxResult,
  TxPayloadTypeID as TxPayloadTypeIDType,
  TxPayloadTokenTransfer,
  TxPayloadSmartContract,
  TxPayloadVersionedSmartContract,
  TxPayloadContractCall,
  TxPayloadCoinbase,
  TxPayloadCoinbaseToAltRecipient,
  TxPayloadNakamotoCoinbase,
  TxPayloadTenureChange,
} from '@hirosystems/stacks-encoding-native-js';
import { STX_CURRENCY } from './constants.js';

const {
  TxPayloadTypeID,
  PostConditionAuthFlag,
  PrincipalTypeID,
  memoToString,
} = stacksEncoding;

// Transaction status for confirmed blocks is always success (they made it into a block)
const OPERATION_STATUS_SUCCESS = 'success';

export interface ConvertBlockOptions {
  /** Currency to use for amounts. Defaults to STX_CURRENCY */
  currency?: Currency;
}

export interface ConvertTransactionOptions {
  /** Currency to use for amounts. Defaults to STX_CURRENCY */
  currency?: Currency;
}

/**
 * Converts a decoded Stacks Nakamoto block to Mesh API Block format.
 */
export function convertDecodedBlockToMeshBlock(
  decodedBlock: DecodedNakamotoBlockResult,
  blockHeight: number,
  parentBlockHash: string,
  options?: ConvertBlockOptions
): Block {
  const currency = options?.currency ?? STX_CURRENCY;

  return {
    block_identifier: {
      index: blockHeight,
      hash: decodedBlock.block_id,
    },
    parent_block_identifier: {
      index: blockHeight > 0 ? blockHeight - 1 : 0,
      hash: parentBlockHash,
    },
    timestamp: Number(decodedBlock.header.timestamp) * 1000, // Convert to milliseconds
    transactions: decodedBlock.txs.map((tx) =>
      convertDecodedTxToMeshTransaction(tx, { currency })
    ),
  };
}

/**
 * Converts a decoded Stacks transaction to Mesh API Transaction format.
 */
export function convertDecodedTxToMeshTransaction(
  tx: DecodedTxResult,
  options?: ConvertTransactionOptions
): Transaction {
  const currency = options?.currency ?? STX_CURRENCY;
  const operations = buildOperationsFromDecodedTx(tx, currency);
  const senderAddress = getSenderAddress(tx);

  return {
    transaction_identifier: {
      hash: tx.tx_id.startsWith('0x') ? tx.tx_id : `0x${tx.tx_id}`,
    },
    operations,
    metadata: {
      tx_type: getPayloadTypeName(tx.payload.type_id),
      fee_rate: getTxFee(tx),
      nonce: getNonce(tx),
      sender_address: senderAddress,
      sponsored: tx.auth.type_id === PostConditionAuthFlag.Sponsored,
    },
  };
}

function buildOperationsFromDecodedTx(tx: DecodedTxResult, currency: Currency): Operation[] {
  const operations: Operation[] = [];
  let operationIndex = 0;
  const status = OPERATION_STATUS_SUCCESS;
  const senderAddress = getSenderAddress(tx);
  const fee = getTxFee(tx);

  // Add fee operation (sender pays fee)
  if (BigInt(fee) > 0n) {
    operations.push({
      operation_identifier: { index: operationIndex++ },
      type: 'fee',
      status,
      account: {
        address: senderAddress,
      },
      amount: {
        value: `-${fee}`,
        currency,
      },
    });
  }

  // Handle different payload types
  const payload = tx.payload;

  switch (payload.type_id) {
    case TxPayloadTypeID.TokenTransfer: {
      const transfer = payload as TxPayloadTokenTransfer;
      const recipientAddress = getRecipientAddress(transfer.recipient);

      // Debit from sender
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'transfer',
        status,
        account: {
          address: senderAddress,
        },
        amount: {
          value: `-${transfer.amount}`,
          currency,
        },
      });

      // Credit to recipient
      operations.push({
        operation_identifier: { index: operationIndex++ },
        related_operations: [{ index: operationIndex - 2 }],
        type: 'transfer',
        status,
        account: {
          address: recipientAddress,
        },
        amount: {
          value: transfer.amount,
          currency,
        },
        metadata: {
          memo: decodeMemo(transfer.memo_hex),
        },
      });
      break;
    }

    case TxPayloadTypeID.Coinbase: {
      const coinbase = payload as TxPayloadCoinbase;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'coinbase',
        status,
        account: {
          address: senderAddress,
        },
        metadata: {
          coinbase_data: coinbase.payload_buffer,
        },
      });
      break;
    }

    case TxPayloadTypeID.CoinbaseToAltRecipient: {
      const coinbase = payload as TxPayloadCoinbaseToAltRecipient;
      const recipient = getRecipientAddress(coinbase.recipient);
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'coinbase',
        status,
        account: {
          address: recipient,
        },
        metadata: {
          coinbase_data: coinbase.payload_buffer,
        },
      });
      break;
    }

    case TxPayloadTypeID.NakamotoCoinbase: {
      const coinbase = payload as TxPayloadNakamotoCoinbase;
      const recipient = coinbase.recipient
        ? getRecipientAddress(coinbase.recipient)
        : senderAddress;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'coinbase',
        status,
        account: {
          address: recipient,
        },
        metadata: {
          coinbase_data: coinbase.payload_buffer,
          vrf_proof: coinbase.vrf_proof,
        },
      });
      break;
    }

    case TxPayloadTypeID.SmartContract: {
      const contract = payload as TxPayloadSmartContract;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'smart_contract',
        status,
        account: {
          address: senderAddress,
        },
        metadata: {
          contract_id: `${senderAddress}.${contract.contract_name}`,
        },
      });
      break;
    }

    case TxPayloadTypeID.VersionedSmartContract: {
      const contract = payload as TxPayloadVersionedSmartContract;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'smart_contract',
        status,
        account: {
          address: senderAddress,
        },
        metadata: {
          contract_id: `${senderAddress}.${contract.contract_name}`,
          clarity_version: contract.clarity_version,
        },
      });
      break;
    }

    case TxPayloadTypeID.ContractCall: {
      const call = payload as TxPayloadContractCall;
      const contractId = `${call.address}.${call.contract_name}`;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'contract_call',
        status,
        account: {
          address: senderAddress,
        },
        metadata: {
          contract_id: contractId,
          function_name: call.function_name,
          function_args: call.function_args.map((arg) => ({
            hex: arg.hex,
            repr: arg.repr,
          })),
        },
      });
      break;
    }

    case TxPayloadTypeID.TenureChange: {
      const tenure = payload as TxPayloadTenureChange;
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'tenure_change',
        status,
        account: {
          address: senderAddress,
        },
        metadata: {
          tenure_consensus_hash: tenure.tenure_consensus_hash,
          prev_tenure_consensus_hash: tenure.prev_tenure_consensus_hash,
          burn_view_consensus_hash: tenure.burn_view_consensus_hash,
          previous_tenure_end: tenure.previous_tenure_end,
          previous_tenure_blocks: tenure.previous_tenure_blocks,
          cause: tenure.cause,
          pubkey_hash: tenure.pubkey_hash,
        },
      });
      break;
    }

    case TxPayloadTypeID.PoisonMicroblock: {
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'poison_microblock',
        status,
        account: {
          address: senderAddress,
        },
      });
      break;
    }

    default:
      // Unknown payload type - create generic operation
      operations.push({
        operation_identifier: { index: operationIndex++ },
        type: 'unknown',
        status,
        account: {
          address: senderAddress,
        },
      });
  }

  return operations;
}

function getSenderAddress(tx: DecodedTxResult): string {
  const originCondition = tx.auth.origin_condition;
  return originCondition.signer.address;
}

function getTxFee(tx: DecodedTxResult): string {
  return tx.auth.origin_condition.tx_fee;
}

function getNonce(tx: DecodedTxResult): string {
  return tx.auth.origin_condition.nonce;
}

function getRecipientAddress(
  recipient:
    | { type_id: number; address: string; contract_name?: string }
    | null
): string {
  if (!recipient) {
    return '';
  }
  if (recipient.type_id === PrincipalTypeID.Contract && recipient.contract_name) {
    return `${recipient.address}.${recipient.contract_name}`;
  }
  return recipient.address;
}

/**
 * Get the human-readable name for a transaction payload type.
 */
export function getPayloadTypeName(typeId: TxPayloadTypeIDType): string {
  switch (typeId) {
    case TxPayloadTypeID.TokenTransfer:
      return 'token_transfer';
    case TxPayloadTypeID.SmartContract:
      return 'smart_contract';
    case TxPayloadTypeID.VersionedSmartContract:
      return 'versioned_smart_contract';
    case TxPayloadTypeID.ContractCall:
      return 'contract_call';
    case TxPayloadTypeID.Coinbase:
      return 'coinbase';
    case TxPayloadTypeID.CoinbaseToAltRecipient:
      return 'coinbase_to_alt_recipient';
    case TxPayloadTypeID.NakamotoCoinbase:
      return 'nakamoto_coinbase';
    case TxPayloadTypeID.TenureChange:
      return 'tenure_change';
    case TxPayloadTypeID.PoisonMicroblock:
      return 'poison_microblock';
    default:
      return 'unknown';
  }
}

function decodeMemo(memoHex: string): string {
  try {
    // Remove 0x prefix if present
    const hex = memoHex.startsWith('0x') ? memoHex.slice(2) : memoHex;
    return memoToString(Buffer.from(hex, 'hex'));
  } catch {
    return memoHex;
  }
}
