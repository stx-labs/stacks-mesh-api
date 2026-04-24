import { hexToBuffer } from '@stacks/api-toolkit';
import { Transaction, Operation, Status, Currency } from '@stacks/mesh-schemas';
import codec from '@stacks/codec';
import { isPoxPrintEvent, makeSyntheticPoxOperation } from './pox-operations.js';
import { ApiConfig } from '../api/index.js';
import { serializePostConditions } from './post-conditions.js';
import { addHexPrefix, decodeClarityValue, removeHexPrefix } from './index.js';
import BigNumber from 'bignumber.js';
import type {
  BlockReplayTransaction,
  BlockReplayTransactionContractEvent,
  BlockReplayTransactionFtBurnEvent,
  BlockReplayTransactionFtMintEvent,
  BlockReplayTransactionFtTransferEvent,
  BlockReplayTransactionNftBurnEvent,
  BlockReplayTransactionNftEvent,
  BlockReplayTransactionNftMintEvent,
  BlockReplayTransactionNftTransferEvent,
  BlockReplayTransactionStxBurnEvent,
  BlockReplayTransactionStxLockEvent,
  BlockReplayTransactionStxTransferEvent,
} from '@stacks/rpc-client';
import { BlockReplayTransactionFtEvent } from '@stacks/rpc-client';

/**
 * A decoded Stacks Nakamoto transaction.
 */
export type DecodedStacksTransaction = {
  replayedTx: BlockReplayTransaction;
  decodedTx: codec.DecodedTxResult;
  fee: number;
  sponsored: boolean;
  senderAddress: string;
  sponsorAddress: string | null;
  nonce: number;
  status: Status;
};

export async function serializeReplayedNakamotoTransaction(
  replayedTx: BlockReplayTransaction,
  fee: number,
  index: number,
  config: ApiConfig
): Promise<Transaction> {
  const decodedTx = codec.decodeTransaction(replayedTx.hex);
  const tx: DecodedStacksTransaction = {
    replayedTx,
    decodedTx,
    fee,
    sponsored: decodedTx.auth.type_id === codec.PostConditionAuthFlag.Sponsored,
    senderAddress: decodedTx.auth.origin_condition.signer.address,
    sponsorAddress:
      decodedTx.auth.type_id === codec.PostConditionAuthFlag.Sponsored
        ? decodedTx.auth.sponsor_condition.signer.address
        : null,
    nonce: parseInt(decodedTx.auth.origin_condition.nonce),
    status: serializeTxStatus(replayedTx),
  };
  return {
    transaction_identifier: {
      hash: addHexPrefix(replayedTx.txid),
    },
    operations: await serializeStacksTransactionOperations(tx, config),
    metadata: {
      status: tx.status,
      type: serializeTxType(tx.decodedTx),
      sponsored: tx.sponsored,
      canonical: true,
      execution_cost: {
        read_count: replayedTx.execution_cost.read_count,
        read_length: replayedTx.execution_cost.read_length,
        runtime: replayedTx.execution_cost.runtime,
        write_count: replayedTx.execution_cost.write_count,
        write_length: replayedTx.execution_cost.write_length,
      },
      fee_rate: fee.toString(),
      nonce: tx.nonce,
      position: {
        index,
      },
      raw_tx: addHexPrefix(replayedTx.hex),
      result: serializeTxResult(replayedTx),
      sender_address: tx.senderAddress,
      sponsor_address: tx.sponsorAddress,
      vm_error: replayedTx.vm_error,
      post_conditions: serializePostConditions(tx),
    },
  };
}

function serializeTxResult(tx: BlockReplayTransaction) {
  return decodeClarityValue(tx.result_hex);
}

function serializeTxStatus(replayedTx: BlockReplayTransaction): Status {
  const result = codec.decodeClarityValue(removeHexPrefix(replayedTx.result_hex));
  if (result.type_id === codec.ClarityTypeID.ResponseError) {
    if (replayedTx.post_condition_aborted) return 'abort_by_post_condition';
    return 'abort_by_response';
  }
  if (result.type_id !== codec.ClarityTypeID.ResponseOk) {
    throw new Error(`Unexpected transaction result type: ${result.type_id}`);
  }
  return 'success';
}

function serializeTxType(decodedTx: codec.DecodedTxResult) {
  switch (decodedTx.payload.type_id) {
    case codec.TxPayloadTypeID.TenureChange:
      return 'tenure_change';
    case codec.TxPayloadTypeID.TokenTransfer:
      return 'token_transfer';
    case codec.TxPayloadTypeID.SmartContract:
    case codec.TxPayloadTypeID.VersionedSmartContract:
      return 'contract_deploy';
    case codec.TxPayloadTypeID.ContractCall:
      return 'contract_call';
    case codec.TxPayloadTypeID.PoisonMicroblock:
      return 'poison_microblock';
    case codec.TxPayloadTypeID.Coinbase:
    case codec.TxPayloadTypeID.CoinbaseToAltRecipient:
    case codec.TxPayloadTypeID.NakamotoCoinbase:
      return 'coinbase';
    default:
      throw new Error('Unexpected transaction payload type');
  }
}

function parseTransactionMemo(memoHex: string | undefined): string | null {
  if (!memoHex) return null;
  // Memos are a fixed-length 34 byte array. Any memo representing a string that is
  // less than 34 bytes long will have right-side padded null-bytes.
  let memoBuffer = hexToBuffer(memoHex);
  while (memoBuffer.length > 0 && memoBuffer[memoBuffer.length - 1] === 0) {
    memoBuffer = memoBuffer.subarray(0, memoBuffer.length - 1);
  }
  if (memoBuffer.length === 0) return null;
  return memoBuffer.toString('utf8');
}

export function makeStxCurrency(): Currency {
  return {
    symbol: 'STX',
    decimals: 6,
  };
}

function makeFeeOperation(tx: DecodedStacksTransaction, index: number = 0): Operation {
  return {
    operation_identifier: { index },
    type: 'fee',
    status: tx.status,
    account: {
      address: tx.sponsorAddress ?? tx.senderAddress,
    },
    amount: {
      currency: makeStxCurrency(),
      value: BigNumber(tx.fee).negated().toString(),
    },
    metadata: {
      sponsored: tx.sponsored,
    },
  };
}

function makeStxTransferOperations(
  tx: DecodedStacksTransaction,
  index: number,
  event?: BlockReplayTransactionStxTransferEvent
): Operation[] {
  let sender: string;
  let recipient: string;
  let amount: string;
  let memo: string | null;

  if (tx.decodedTx.payload.type_id === codec.TxPayloadTypeID.TokenTransfer && !event) {
    const payload = tx.decodedTx.payload as codec.TxPayloadTokenTransfer;
    sender = tx.senderAddress;
    recipient = payload.recipient.address;
    amount = payload.amount;
    memo = parseTransactionMemo(addHexPrefix(payload.memo_hex));
  } else if (event) {
    sender = event.stx_transfer_event.sender;
    recipient = event.stx_transfer_event.recipient;
    amount = event.stx_transfer_event.amount;
    memo = parseTransactionMemo(addHexPrefix(event.stx_transfer_event.memo));
  } else {
    throw new Error('No event or payload found for stx transfer');
  }

  const send: Operation = {
    operation_identifier: { index },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: sender,
    },
    amount: {
      value: BigNumber(amount).negated().toString(),
      currency: makeStxCurrency(),
    },
    metadata: {
      memo,
    },
  };
  const receive: Operation = {
    operation_identifier: { index: index + 1 },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: recipient,
    },
    amount: {
      value: BigNumber(amount).toString(),
      currency: makeStxCurrency(),
    },
    metadata: {
      memo,
    },
  };
  return [send, receive];
}

async function makeContractCallOperation(
  tx: DecodedStacksTransaction,
  index: number,
  config: ApiConfig
): Promise<Operation> {
  const decodedPayload = tx.decodedTx.payload as codec.TxPayloadContractCall;
  const contractIdentifier = `${decodedPayload.address}.${decodedPayload.contract_name}`;
  const operation: Operation = {
    operation_identifier: { index },
    type: 'contract_call',
    status: tx.status,
    account: {
      address: tx.decodedTx.auth.origin_condition.signer.address,
    },
    metadata: {
      args: [],
      contract_identifier: contractIdentifier,
      function_name: decodedPayload.function_name,
    },
  };
  // Serialize function arguments. Look at the contract's interface to determine the function
  // argument's name and type.
  const abi = await config.contractAbiCache.get(contractIdentifier);
  if (abi !== null) {
    const functionAbi = abi.functions.find(fn => fn.name === decodedPayload.function_name);
    if (!functionAbi) {
      throw new Error(
        `Could not find function name "${decodedPayload.function_name}" in ABI for ${contractIdentifier}`
      );
    }
    operation.metadata.args = decodedPayload.function_args.map((c, fnArgIndex) => {
      const functionArgAbi = functionAbi
        ? functionAbi.args[fnArgIndex++]
        : { name: '', type: undefined };
      return {
        hex: addHexPrefix(c.hex),
        repr: c.repr,
        name: functionArgAbi.name,
        type: codec.decodeClarityValueToTypeName(c.hex),
      };
    });
  }
  return operation;
}

function makeSmartContractOperation(tx: DecodedStacksTransaction, index: number): Operation {
  const payload = tx.decodedTx.payload as
    | codec.TxPayloadSmartContract
    | codec.TxPayloadVersionedSmartContract;
  return {
    operation_identifier: { index },
    type: 'contract_deploy',
    status: tx.status,
    account: {
      address: tx.senderAddress,
    },
    metadata: {
      contract_identifier: `${tx.senderAddress}.${payload.contract_name}`,
      source_code: payload.code_body,
      clarity_version:
        (payload as codec.TxPayloadVersionedSmartContract).clarity_version ??
        codec.ClarityVersion.Clarity1,
      abi: undefined, // TODO: Implement abi
    },
  };
}

function makeCoinbaseOperation(tx: DecodedStacksTransaction, index: number = 0): Operation {
  const payload = tx.decodedTx.payload;
  return {
    operation_identifier: { index },
    type: 'coinbase',
    status: tx.status,
    account: {
      address: tx.senderAddress,
    },
    metadata: {
      alt_recipient: (payload as codec.TxPayloadCoinbaseToAltRecipient).recipient?.address ?? null,
      vrf_proof: (payload as codec.TxPayloadNakamotoCoinbase).vrf_proof ?? null,
    },
  };
}

function makeTenureChangeOperation(tx: DecodedStacksTransaction, index: number = 0): Operation {
  const getCause = (cause: codec.TenureChangeCause) => {
    switch (cause) {
      case codec.TenureChangeCause.BlockFound:
        return 'block_found';
      case codec.TenureChangeCause.Extended:
        return 'extended';
      case codec.TenureChangeCause.ExtendedRuntime:
        return 'extended_runtime';
      case codec.TenureChangeCause.ExtendedReadCount:
        return 'extended_read_count';
      case codec.TenureChangeCause.ExtendedReadLength:
        return 'extended_read_length';
      case codec.TenureChangeCause.ExtendedWriteCount:
        return 'extended_write_count';
      case codec.TenureChangeCause.ExtendedWriteLength:
        return 'extended_write_length';
      default:
        throw new Error(`Unexpected tenure change cause: ${cause}`);
    }
  };
  const payload = tx.decodedTx.payload as codec.TxPayloadTenureChange;
  return {
    operation_identifier: { index },
    type: 'tenure_change',
    status: tx.status,
    metadata: {
      tenure_consensus_hash: addHexPrefix(payload.tenure_consensus_hash),
      prev_tenure_consensus_hash: addHexPrefix(payload.prev_tenure_consensus_hash),
      burn_view_consensus_hash: addHexPrefix(payload.burn_view_consensus_hash),
      previous_tenure_blocks: payload.previous_tenure_blocks,
      previous_tenure_end: addHexPrefix(payload.previous_tenure_end),
      cause: getCause(payload.cause),
      pubkey_hash: addHexPrefix(payload.pubkey_hash),
    },
  };
}

function makeStxBurnOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionStxBurnEvent,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'token_burn',
    status: tx.status,
    account: {
      address: event.stx_burn_event.sender,
    },
    amount: {
      value: BigNumber(event.stx_burn_event.amount).negated().toString(),
      currency: makeStxCurrency(),
    },
  };
}

function makeStxLockOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionStxLockEvent,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'stx_lock',
    status: tx.status,
    account: {
      address: event.stx_lock_event.locked_address,
    },
    amount: {
      value: BigNumber(event.stx_lock_event.locked_amount).negated().toString(),
      currency: makeStxCurrency(),
    },
    metadata: {
      unlock_height: parseInt(event.stx_lock_event.unlock_height),
      locked_address: event.stx_lock_event.locked_address,
      contract_name: event.stx_lock_event.contract_identifier,
    },
  };
}

// function makeStxMintOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbStxEvent,
//   index: number
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'token_mint',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.recipient),
//     },
//     amount: {
//       value: event.amount.toString(),
//       currency: makeStxCurrency(),
//     },
//   };
// }

async function makeFtCurrency(
  event: BlockReplayTransactionFtEvent,
  config: ApiConfig
): Promise<Currency> {
  const asset_identifier =
    'ft_mint_event' in event
      ? event.ft_mint_event.asset_identifier
      : 'ft_transfer_event' in event
        ? event.ft_transfer_event.asset_identifier
        : event.ft_burn_event.asset_identifier;
  const metadata = await config.tokenMetadataCache.get(asset_identifier);
  return {
    symbol: metadata?.symbol ?? '',
    decimals: metadata?.decimals ?? 0,
    metadata: {
      token_type: 'ft',
      asset_identifier,
      name: metadata?.name ?? undefined,
    },
  };
}

async function makeFtTransferOperations(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionFtTransferEvent,
  index: number,
  config: ApiConfig
): Promise<Operation[]> {
  const currency = await makeFtCurrency(event, config);
  const send: Operation = {
    operation_identifier: { index },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: event.ft_transfer_event.sender,
    },
    amount: {
      value: BigNumber(event.ft_transfer_event.amount).negated().toString(),
      currency,
    },
  };
  const receive: Operation = {
    operation_identifier: { index: index + 1 },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: event.ft_transfer_event.recipient,
    },
    amount: {
      value: event.ft_transfer_event.amount,
      currency,
    },
  };
  return [send, receive];
}

async function makeFtMintOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionFtMintEvent,
  index: number,
  config: ApiConfig
): Promise<Operation> {
  return {
    operation_identifier: { index },
    type: 'token_mint',
    status: tx.status,
    account: {
      address: event.ft_mint_event.recipient,
    },
    amount: {
      value: event.ft_mint_event.amount,
      currency: await makeFtCurrency(event, config),
    },
  };
}

async function makeFtBurnOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionFtBurnEvent,
  index: number,
  config: ApiConfig
): Promise<Operation> {
  return {
    operation_identifier: { index },
    type: 'token_burn',
    status: tx.status,
    account: {
      address: event.ft_burn_event.sender,
    },
    amount: {
      value: BigNumber(event.ft_burn_event.amount).negated().toString(),
      currency: await makeFtCurrency(event, config),
    },
  };
}

function makeNftCurrency(event: BlockReplayTransactionNftEvent): Currency {
  const asset_identifier =
    'nft_mint_event' in event
      ? event.nft_mint_event.asset_identifier
      : 'nft_transfer_event' in event
        ? event.nft_transfer_event.asset_identifier
        : event.nft_burn_event.asset_identifier;
  const value =
    'nft_mint_event' in event
      ? event.nft_mint_event.raw_value
      : 'nft_transfer_event' in event
        ? event.nft_transfer_event.raw_value
        : event.nft_burn_event.raw_value;
  return {
    symbol: asset_identifier.split('::')[1],
    decimals: 0,
    metadata: {
      token_type: 'nft',
      asset_identifier,
      value,
    },
  };
}

function makeNftTransferOperations(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionNftTransferEvent,
  index: number
): Operation[] {
  const currency = makeNftCurrency(event);
  const send: Operation = {
    operation_identifier: { index },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: event.nft_transfer_event.sender,
    },
    amount: {
      value: '-1',
      currency,
    },
  };
  const receive: Operation = {
    operation_identifier: { index: index + 1 },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: event.nft_transfer_event.recipient,
    },
    amount: {
      value: '1',
      currency,
    },
  };
  return [send, receive];
}

function makeNftMintOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionNftMintEvent,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'token_mint',
    status: tx.status,
    account: {
      address: event.nft_mint_event.recipient,
    },
    amount: {
      value: '1',
      currency: makeNftCurrency(event),
    },
  };
}

function makeNftBurnOperation(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionNftBurnEvent,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'token_burn',
    status: tx.status,
    account: {
      address: event.nft_burn_event.sender,
    },
    amount: {
      value: '-1',
      currency: makeNftCurrency(event),
    },
  };
}

function makeContractEventOperations(
  tx: DecodedStacksTransaction,
  event: BlockReplayTransactionContractEvent,
  index: number,
  config: ApiConfig
): Operation[] {
  const ops: Operation[] = [];
  ops.push({
    operation_identifier: { index },
    type: 'contract_log',
    status: tx.status,
    metadata: {
      value: decodeClarityValue(event.contract_event.raw_value),
      contract_identifier: event.contract_event.contract_identifier,
      topic: event.contract_event.topic,
    },
  });
  if (isPoxPrintEvent(event)) {
    try {
      const poxEvent = codec.decodePoxSyntheticEvent(
        event.contract_event.raw_value,
        config.network
      );
      if (poxEvent) ops.push(makeSyntheticPoxOperation(poxEvent, index + 1, tx));
    } catch (error) {
      // Not a valid synthetic PoX event
    }
  }
  return ops;
}

export async function serializeStacksTransactionOperations(
  tx: DecodedStacksTransaction,
  config: ApiConfig
): Promise<Operation[]> {
  const ops: Operation[] = [];
  if (tx.fee > 0) ops.push(makeFeeOperation(tx));

  // Add operations from transaction data.
  switch (tx.decodedTx.payload.type_id) {
    case codec.TxPayloadTypeID.TenureChange:
      ops.push(makeTenureChangeOperation(tx, ops.length));
      break;
    case codec.TxPayloadTypeID.TokenTransfer:
      ops.push(...makeStxTransferOperations(tx, ops.length));
      break;
    case codec.TxPayloadTypeID.SmartContract:
    case codec.TxPayloadTypeID.VersionedSmartContract:
      ops.push(makeSmartContractOperation(tx, ops.length));
      break;
    case codec.TxPayloadTypeID.ContractCall:
      ops.push(await makeContractCallOperation(tx, ops.length, config));
      break;
    case codec.TxPayloadTypeID.PoisonMicroblock:
      // Not supported.
      break;
    case codec.TxPayloadTypeID.Coinbase:
    case codec.TxPayloadTypeID.CoinbaseToAltRecipient:
    case codec.TxPayloadTypeID.NakamotoCoinbase:
      ops.push(makeCoinbaseOperation(tx, ops.length));
      // TODO: Add miner rewards
      break;
  }

  for (const event of tx.replayedTx.events) {
    switch (event.type) {
      case 'stx_transfer_event':
        // Operations were already added in the transaction phase above if this was a token transfer
        // transaction. Otherwise, add the operations from events generated by contract calls.
        if (tx.decodedTx.payload.type_id !== codec.TxPayloadTypeID.TokenTransfer) {
          ops.push(...makeStxTransferOperations(tx, ops.length, event));
        }
        break;
      case 'stx_burn_event':
        ops.push(makeStxBurnOperation(tx, event, ops.length));
        break;
      case 'stx_lock_event':
        ops.push(makeStxLockOperation(tx, event, ops.length));
        break;
      // TODO: stx mint not reported in events from core, see block
      // 0xe1410b8188303242471a57e8bca75c5f61ba8537dfe3d1b92b9cca655e59c16b
      case 'ft_mint_event':
        ops.push(await makeFtMintOperation(tx, event, ops.length, config));
        break;
      case 'ft_transfer_event':
        ops.push(...(await makeFtTransferOperations(tx, event, ops.length, config)));
        break;
      case 'ft_burn_event':
        ops.push(await makeFtBurnOperation(tx, event, ops.length, config));
        break;
      case 'nft_transfer_event':
        ops.push(...makeNftTransferOperations(tx, event, ops.length));
        break;
      case 'nft_mint_event':
        ops.push(makeNftMintOperation(tx, event, ops.length));
        break;
      case 'nft_burn_event':
        ops.push(makeNftBurnOperation(tx, event, ops.length));
        break;
      case 'contract_event':
        ops.push(...makeContractEventOperations(tx, event, ops.length, config));
        break;
    }
  }
  // Add operations from transaction events.
  // TODO: Complete all event types.
  // if (transaction.events.length) {
  //   for (const event of transaction.events) {
  //     switch (event.event_type) {
  //       case StacksDbEventTypeId.StxAsset:
  //         switch (event.asset_event_type_id) {
  //           case StacksDbAssetEventTypeId.Mint:
  //             ops.push(makeStxMintOperation(tx, event, ops.length));
  //             break;
  //         }
  //         break;
  //     }
  //   }
  // }

  return ops;
}
