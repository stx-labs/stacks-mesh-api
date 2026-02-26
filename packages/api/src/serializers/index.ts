import { hexToBuffer } from '@stacks/api-toolkit';
import {
  Block,
  Transaction,
  Operation,
  Status,
  Currency,
  PostConditionPrincipal,
  PostCondition,
  PostConditionMode,
} from '@stacks/mesh-schemas';
import codec from '@stacks/codec';
import {
  StacksBlockReplay,
  StacksBlockReplayTransaction,
  StacksBlockReplayTransactionContractEvent,
  StacksBlockReplayTransactionFtBurnEvent,
  StacksBlockReplayTransactionFtEvent,
  StacksBlockReplayTransactionFtMintEvent,
  StacksBlockReplayTransactionFtTransferEvent,
  StacksBlockReplayTransactionNftBurnEvent,
  StacksBlockReplayTransactionNftEvent,
  StacksBlockReplayTransactionNftMintEvent,
  StacksBlockReplayTransactionNftTransferEvent,
  StacksBlockReplayTransactionPayload,
  StacksBlockReplayTransactionStxBurnEvent,
  StacksBlockReplayTransactionStxLockEvent,
  StacksBlockReplayTransactionStxTransferEvent,
} from '../stacks-rpc/types.js';
import { StacksRpcTransactionNotFoundError } from '../stacks-rpc/errors.js';
import { TokenMetadataCache } from '../cache/token-metadata-cache.js';
import { ContractAbiCache } from '../cache/contract-abi-cache.js';
import { getTypeString } from '@stacks/transactions';

/**
 * Configuration for serializing Stacks Nakamoto blocks to Mesh API format.
 */
export type MeshSerializationConfig = {
  tokenMetadataCache: TokenMetadataCache;
  contractAbiCache: ContractAbiCache;
};

/**
 * A decoded Stacks Nakamoto transaction.
 */
type DecodedStacksTransaction = {
  replayedTx: StacksBlockReplayTransaction;
  decodedTx: codec.DecodedTxResult;
  fee: number;
  sponsored: boolean;
  senderAddress: string;
  sponsorAddress: string | null;
  nonce: number;
  status: Status;
};

export function removeHexPrefix(hex: string): string {
  if (hex.startsWith('0x')) {
    return hex.slice(2);
  }
  return hex;
}

export function addHexPrefix(hex: string): string {
  if (!hex.startsWith('0x')) {
    return `0x${hex}`;
  }
  return hex;
}

/**
 * Converts a decoded Stacks Nakamoto block to Mesh API Block format.
 * @param replay - The replayed Nakamoto block.
 * @returns The serialized block.
 */
export async function serializeReplayedNakamotoBlock(
  replay: StacksBlockReplay,
  config: MeshSerializationConfig
): Promise<Block> {
  const blockHeight = replay.block_height;
  const block: Block = {
    block_identifier: {
      index: blockHeight,
      hash: addHexPrefix(replay.block_id),
    },
    parent_block_identifier: {
      index: blockHeight > 0 ? blockHeight - 1 : 0,
      hash: addHexPrefix(replay.parent_block_id),
    },
    timestamp: Number(replay.timestamp) * 1000,
    transactions: [],
    metadata: {
      canonical: true,
      tx_count: replay.transactions.length,
      execution_cost: {
        read_count: 0,
        read_length: 0,
        runtime: 0,
        write_count: 0,
        write_length: 0,
      },
    },
  };
  for (let i = 0; i < replay.transactions.length; i++) {
    // TODO: `tx_index` does not work from Stacks core (it's always 0).
    const tx = replay.transactions[i];
    block.metadata!.execution_cost!.read_count += tx.execution_cost.read_count;
    block.metadata!.execution_cost!.read_length += tx.execution_cost.read_length;
    block.metadata!.execution_cost!.runtime += tx.execution_cost.runtime;
    block.metadata!.execution_cost!.write_count += tx.execution_cost.write_count;
    block.metadata!.execution_cost!.write_length += tx.execution_cost.write_length;
    const serializedTx = await serializeReplayedNakamotoTransaction(tx, replay.fees, i, config);
    block.transactions.push(serializedTx);
  }

  return block;
}

/**
 * Retrieves a transaction from a replayed Nakamoto block and serializes it to Mesh API Transaction
 * format.
 * @param replay - The replayed Nakamoto block.
 * @param txId - The ID of the transaction to serialize.
 * @returns The serialized transaction.
 */
export async function serializeTransactionFromReplayedNakamotoBlock(
  replay: StacksBlockReplay,
  txId: string,
  config: MeshSerializationConfig
): Promise<Transaction> {
  // TODO: `tx_index` does not work from Stacks core (it's always 0). We need to traverse the entire
  // array to determine the index.
  let index = 0;
  for (const tx of replay.transactions) {
    if (`0x${tx.txid}` === txId) {
      return serializeReplayedNakamotoTransaction(tx, replay.fees, index, config);
    }
    index++;
  }
  throw new StacksRpcTransactionNotFoundError(txId);
}

async function serializeReplayedNakamotoTransaction(
  replayedTx: StacksBlockReplayTransaction,
  fee: number,
  index: number,
  config: MeshSerializationConfig
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
      type: serializeTxType(replayedTx.data.payload),
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

function serializeTxResult(tx: StacksBlockReplayTransaction) {
  return {
    hex: addHexPrefix(tx.result_hex),
    repr: codec.decodeClarityValueToRepr(tx.result_hex),
  };
}

function serializePostConditions(tx: DecodedStacksTransaction) {
  const serializePostConditionPrincipal = (
    principal: codec.PostConditionPrincipal
  ): PostConditionPrincipal => {
    if (principal.type_id === codec.PostConditionPrincipalTypeID.Standard) {
      return {
        type_id: 'principal_standard',
        address: principal.address,
      };
    }
    if (principal.type_id === codec.PostConditionPrincipalTypeID.Contract) {
      return {
        type_id: 'principal_contract',
        contract_name: principal.contract_name,
        address: principal.address,
      };
    }
    return {
      type_id: 'principal_origin',
    };
  };
  const serializePostCondition = (pc: codec.TxPostCondition): PostCondition => {
    switch (pc.asset_info_id) {
      case codec.PostConditionAssetInfoID.STX:
        return {
          type: 'stx',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
        };
      case codec.PostConditionAssetInfoID.FungibleAsset:
        return {
          type: 'fungible',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
          asset: {
            contract_name: pc.asset.contract_name,
            asset_name: pc.asset.asset_name,
            contract_address: pc.asset.contract_address,
          },
        };
      case codec.PostConditionAssetInfoID.NonfungibleAsset:
        return {
          type: 'non_fungible',
          condition_code: pc.condition_name,
          principal: serializePostConditionPrincipal(pc.principal),
          asset: {
            contract_name: pc.asset.contract_name,
            asset_name: pc.asset.asset_name,
            contract_address: pc.asset.contract_address,
          },
          asset_value: {
            hex: pc.asset_value.hex,
            repr: pc.asset_value.repr,
          },
        };
    }
  };
  const serializePostConditionMode = (byte: number): PostConditionMode => {
    switch (byte) {
      case 1:
        return 'allow';
      case 2:
        return 'deny';
    }
    throw new Error(`PostConditionMode byte must be either 1 or 2 but was ${byte}`);
  };
  const decodedPostConditions = tx.decodedTx.post_conditions;
  const normalizedPostConditions = decodedPostConditions.map(pc => serializePostCondition(pc));
  return {
    mode: serializePostConditionMode(tx.decodedTx.post_condition_mode),
    post_conditions: normalizedPostConditions,
  };
}

function serializeTxStatus(replayedTx: StacksBlockReplayTransaction): Status {
  if (!replayedTx.result.Response.committed) {
    if (replayedTx.post_condition_aborted) return 'abort_by_post_condition';
    return 'abort_by_response';
  }
  return 'success';
}

function serializeTxType(payload: StacksBlockReplayTransactionPayload) {
  if ('TenureChange' in payload) {
    return 'tenure_change';
  } else if ('TokenTransfer' in payload) {
    return 'token_transfer';
  } else if ('SmartContract' in payload) {
    return 'contract_deploy';
  } else if ('ContractCall' in payload) {
    return 'contract_call';
  } else if ('PoisonMicroblock' in payload) {
    return 'poison_microblock';
  } else if ('Coinbase' in payload) {
    return 'coinbase';
  }
  throw new Error(`Unexpected transaction payload type: ${JSON.stringify(payload)}`);
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

function makeStxCurrency(): Currency {
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
      value: (0n - BigInt(tx.fee)).toString(),
    },
    metadata: {
      sponsored: tx.sponsored,
    },
  };
}

function makeStxTransferOperations(
  tx: DecodedStacksTransaction,
  event: StacksBlockReplayTransactionStxTransferEvent,
  index: number
): Operation[] {
  const memo = parseTransactionMemo(addHexPrefix(event.stx_transfer_event.memo));
  const send: Operation = {
    operation_identifier: { index },
    type: 'token_transfer',
    status: tx.status,
    account: {
      address: event.stx_transfer_event.sender,
    },
    amount: {
      value: (0n - BigInt(event.stx_transfer_event.amount)).toString(),
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
      address: event.stx_transfer_event.recipient,
    },
    amount: {
      value: event.stx_transfer_event.amount,
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
  config: MeshSerializationConfig
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
        hex: c.hex,
        repr: c.repr,
        name: functionArgAbi.name,
        type: functionArgAbi.type
          ? getTypeString(functionArgAbi.type)
          : codec.decodeClarityValueToTypeName(c.hex),
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
  event: StacksBlockReplayTransactionStxBurnEvent,
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
      value: (0n - BigInt(event.stx_burn_event.amount)).toString(),
      currency: makeStxCurrency(),
    },
  };
}

function makeStxLockOperation(
  tx: DecodedStacksTransaction,
  event: StacksBlockReplayTransactionStxLockEvent,
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
      value: (0n - BigInt(event.stx_lock_event.locked_amount)).toString(10),
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
  event: StacksBlockReplayTransactionFtEvent,
  config: MeshSerializationConfig
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
  event: StacksBlockReplayTransactionFtTransferEvent,
  index: number,
  config: MeshSerializationConfig
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
      value: (0n - BigInt(event.ft_transfer_event.amount)).toString(),
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
  event: StacksBlockReplayTransactionFtMintEvent,
  index: number,
  config: MeshSerializationConfig
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
  event: StacksBlockReplayTransactionFtBurnEvent,
  index: number,
  config: MeshSerializationConfig
): Promise<Operation> {
  return {
    operation_identifier: { index },
    type: 'token_burn',
    status: tx.status,
    account: {
      address: event.ft_burn_event.sender,
    },
    amount: {
      value: (0n - BigInt(event.ft_burn_event.amount)).toString(),
      currency: await makeFtCurrency(event, config),
    },
  };
}

function makeNftCurrency(event: StacksBlockReplayTransactionNftEvent): Currency {
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
  event: StacksBlockReplayTransactionNftTransferEvent,
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
  event: StacksBlockReplayTransactionNftMintEvent,
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
  event: StacksBlockReplayTransactionNftBurnEvent,
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

function makeContractEventOperation(
  tx: DecodedStacksTransaction,
  event: StacksBlockReplayTransactionContractEvent,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'contract_log',
    status: tx.status,
    metadata: {
      value: addHexPrefix(event.contract_event.raw_value),
      // value: options.decodeClarityValues
      //   ? {
      //       hex: event.value,
      //       repr: decodeClarityValueToRepr(event.value),
      //     }
      //   : event.value,
      contract_identifier: event.contract_event.contract_identifier,
      topic: event.contract_event.topic,
    },
  };
}

async function serializeStacksTransactionOperations(
  tx: DecodedStacksTransaction,
  config: MeshSerializationConfig
): Promise<Operation[]> {
  const ops: Operation[] = [];
  if (tx.fee > 0) ops.push(makeFeeOperation(tx));

  // Add operations from transaction data.
  switch (tx.decodedTx.payload.type_id) {
    case codec.TxPayloadTypeID.TenureChange:
      ops.push(makeTenureChangeOperation(tx, ops.length));
      break;
    case codec.TxPayloadTypeID.TokenTransfer:
      // Transfers will be added in the events phase below.
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
        ops.push(...makeStxTransferOperations(tx, event, ops.length));
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
        ops.push(makeContractEventOperation(tx, event, ops.length));
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
