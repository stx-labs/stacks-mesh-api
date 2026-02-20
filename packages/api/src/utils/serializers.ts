import { hexToBuffer } from '@stacks/api-toolkit';
import { Block, Transaction, Operation, Status, Currency } from '../../../schemas/dist/index.js';
import codec from '@hirosystems/stacks-encoding-native-js';
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
  StacksBlockReplayTransactionStxTransferEvent,
} from '../stacks-rpc/types.js';
import { StacksRpcTransactionNotFoundError } from '../stacks-rpc/errors.js';

type StacksTransaction = {
  replayedTx: StacksBlockReplayTransaction;
  decodedTx: codec.DecodedTxResult;
  fee: number;
  sponsored: boolean;
  senderAddress: string;
  sponsorAddress: string | null;
  nonce: number;
  status: Status;
};

type TokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
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
export function serializeReplayedNakamotoBlock(replay: StacksBlockReplay): Block {
  const tokenMetadata = new Map<string, TokenMetadata>(); // TODO: implement
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
    transactions: replay.transactions.map((tx, i) =>
      // TODO: `tx_index` does not work from Stacks core (it's always 0).
      serializeReplayedNakamotoTransaction(tx, replay.fees, i, tokenMetadata)
    ),
  };
  // if (options?.includeBlockMetadata || options?.includeBlockSignatures) {
  //   block.metadata = {
  //     burn_block_identifier: {
  //       index: 0, // TODO: Implement burn block height
  //       hash: `0x${decodedBlock.header.consensus_hash}`,
  //     },
  //     burn_block_timestamp: 0, // TODO: Implement burn block timestamp
  //     tenure_height: 0, // TODO: Implement tenure height
  //     execution_cost: {
  //       read_count: block.execution_cost_read_count,
  //       read_length: block.execution_cost_read_length,
  //       runtime: block.execution_cost_runtime,
  //       write_count: block.execution_cost_write_count,
  //       write_length: block.execution_cost_write_length,
  //     },
  //     canonical: true,
  //     parent_microblock_identifier: null,
  //     tx_total_size: unwrap(block.tx_total_size),
  //     tx_count: block.tx_count,
  //     signatures: options.includeBlockSignatures
  //       ? {
  //           signer_bitvec: block.signer_bitvec,
  //           signer_signatures: block.signer_signatures,
  //         }
  //       : undefined,
  //   };
  // }

  return block;
}

/**
 * Retrieves a transaction from a replayed Nakamoto block and serializes it to Mesh API Transaction
 * format.
 * @param replay - The replayed Nakamoto block.
 * @param txId - The ID of the transaction to serialize.
 * @returns The serialized transaction.
 */
export function serializeTransactionFromReplayedNakamotoBlock(
  replay: StacksBlockReplay,
  txId: string
): Transaction {
  // TODO: `tx_index` does not work from Stacks core (it's always 0). We need to traverse the entire
  // array to determine the index.
  let index = 0;
  for (const tx of replay.transactions) {
    if (`0x${tx.txid}` === txId) {
      return serializeReplayedNakamotoTransaction(tx, replay.fees, index, new Map());
    }
    index++;
  }
  throw new StacksRpcTransactionNotFoundError(txId);
}

function serializeReplayedNakamotoTransaction(
  replayedTx: StacksBlockReplayTransaction,
  fee: number,
  index: number,
  tokenMetadata: Map<string, TokenMetadata>
): Transaction {
  const decodedTx = codec.decodeTransaction(replayedTx.hex);
  const tx: StacksTransaction = {
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
    operations: serializeStacksTransactionOperations(tx, tokenMetadata),
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
      post_conditions: undefined, // TODO: Implement post conditions
    },
  };
}

function serializeTxResult(tx: StacksBlockReplayTransaction) {
  // TODO: Decode clarity values
  // if (options.decodeClarityValues) {
  //   return {
  //     hex: raw_result,
  //     repr: decodeClarityValueToRepr(raw_result),
  //   };
  // }
  return addHexPrefix(tx.result_hex);
}

// function serializePostConditions(tx: StacksDbTransaction, options: StacksSerializationOptions) {
//   if (!options.includePostConditions) {
//     return undefined;
//   }
//   const serializePostConditionPrincipal = (
//     principal: PostConditionPrincipal
//   ): StacksPostConditionPrincipal => {
//     if (principal.type_id === PostConditionPrincipalTypeID.Standard) {
//       return {
//         type_id: 'principal_standard',
//         address: principal.address,
//       };
//     }
//     if (principal.type_id === PostConditionPrincipalTypeID.Contract) {
//       return {
//         type_id: 'principal_contract',
//         contract_name: principal.contract_name,
//         address: principal.address,
//       };
//     }
//     return {
//       type_id: 'principal_origin',
//     };
//   };
//   const serializePostCondition = (pc: TxPostCondition): StacksPostCondition => {
//     switch (pc.asset_info_id) {
//       case PostConditionAssetInfoID.STX:
//         return {
//           type: 'stx',
//           condition_code: pc.condition_name,
//           amount: pc.amount,
//           principal: serializePostConditionPrincipal(pc.principal),
//         };
//       case PostConditionAssetInfoID.FungibleAsset:
//         return {
//           type: 'fungible',
//           condition_code: pc.condition_name,
//           amount: pc.amount,
//           principal: serializePostConditionPrincipal(pc.principal),
//           asset: {
//             contract_name: pc.asset.contract_name,
//             asset_name: pc.asset.asset_name,
//             contract_address: pc.asset.contract_address,
//           },
//         };
//       case PostConditionAssetInfoID.NonfungibleAsset:
//         return {
//           type: 'non_fungible',
//           condition_code: pc.condition_name,
//           principal: serializePostConditionPrincipal(pc.principal),
//           asset: {
//             contract_name: pc.asset.contract_name,
//             asset_name: pc.asset.asset_name,
//             contract_address: pc.asset.contract_address,
//           },
//           asset_value: {
//             hex: pc.asset_value.hex,
//             repr: pc.asset_value.repr,
//           },
//         };
//     }
//   };
//   const serializePostConditionMode = (byte: number): StacksPostConditionMode => {
//     switch (byte) {
//       case 1:
//         return 'allow';
//       case 2:
//         return 'deny';
//     }
//     throw new Error(`PostConditionMode byte must be either 1 or 2 but was ${byte}`);
//   };
//   const decodedPostConditions = decodePostConditions(tx.post_conditions);
//   const normalizedPostConditions = decodedPostConditions.post_conditions.map(pc =>
//     serializePostCondition(pc)
//   );
//   return {
//     mode: serializePostConditionMode(decodedPostConditions.post_condition_mode),
//     post_conditions: normalizedPostConditions,
//   };
// }

function serializeTxStatus(replayedTx: StacksBlockReplayTransaction): Status {
  return 'success'; // TODO: Implement status
  // switch (txStatus) {
  //   case StacksDbTxStatus.Pending:
  //     return 'pending';
  //   case StacksDbTxStatus.Success:
  //     return 'success';
  //   case StacksDbTxStatus.AbortByResponse:
  //     return 'abort_by_response';
  //   case StacksDbTxStatus.AbortByPostCondition:
  //     return 'abort_by_post_condition';
  //   case StacksDbTxStatus.DroppedReplaceByFee:
  //     return 'dropped_replace_by_fee';
  //   case StacksDbTxStatus.DroppedReplaceAcrossFork:
  //     return 'dropped_replace_across_fork';
  //   case StacksDbTxStatus.DroppedTooExpensive:
  //     return 'dropped_too_expensive';
  //   case StacksDbTxStatus.DroppedProblematic:
  //     return 'dropped_problematic';
  //   case StacksDbTxStatus.DroppedStaleGarbageCollect:
  //   case StacksDbTxStatus.DroppedApiGarbageCollect:
  //     return 'dropped_stale_garbage_collect';
  //   default:
  //     throw new Error(`Unexpected DbTxStatus: ${txStatus}`);
  // }
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
  if (memoHex) {
    // Memos are a fixed-length 34 byte array. Any memo representing a string that is
    // less than 34 bytes long will have right-side padded null-bytes.
    let memoBuffer = hexToBuffer(memoHex);
    while (memoBuffer.length > 0 && memoBuffer[memoBuffer.length - 1] === 0) {
      memoBuffer = memoBuffer.slice(0, memoBuffer.length - 1);
    }
    if (memoBuffer.length === 0) {
      return null;
    }
    const memoDecoded = memoBuffer.toString('utf8');
    return memoDecoded;
  }
  return null;
}

function makeStxCurrency(): Currency {
  return {
    symbol: 'STX',
    decimals: 6,
  };
}

function makeFeeOperation(tx: StacksTransaction, index: number = 0): Operation {
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
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionStxTransferEvent,
  index: number
): Operation[] {
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
      memo: event.stx_transfer_event.memo,
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
      memo: event.stx_transfer_event.memo,
    },
  };
  // TODO: Implement memo decode
  // if (memo) {
  //   send.metadata = {
  //     memo: options.decodeClarityValues ? parseTransactionMemo(memo) : memo,
  //   };
  //   receive.metadata = {
  //     memo: options.decodeClarityValues ? parseTransactionMemo(memo) : memo,
  //   };
  // }
  return [send, receive];
}

function makeContractCallOperation(tx: StacksTransaction, index: number): Operation {
  const decodedPayload = tx.decodedTx.payload as codec.TxPayloadContractCall;
  const operation: Operation = {
    operation_identifier: { index },
    type: 'contract_call',
    status: tx.status,
    account: {
      address: tx.decodedTx.auth.origin_condition.signer.address,
    },
    metadata: {
      args: decodedPayload.function_args.map(arg => ({
        hex: arg.hex,
        repr: arg.repr,
        name: 'arg.name', // TODO: Implement name
        type: 'arg.type_id', // TODO: Implement type
      })),
      contract_identifier: `${decodedPayload.address}.${decodedPayload.contract_name}`,
      function_name: decodedPayload.function_name,
    },
  };

  // if (options.decodeClarityValues) {
  //   let functionAbi: ClarityAbiFunction | undefined;
  //   if (tx.abi !== null) {
  //     const contractAbi: ClarityAbi = typeof tx.abi === 'string' ? JSON.parse(tx.abi) : tx.abi;
  //     if (contractAbi) {
  //       functionAbi = contractAbi.functions.find(fn => fn.name === functionName);
  //       if (!functionAbi) {
  //         throw new Error(
  //           `Could not find function name "${functionName}" in ABI for ${contractId}`
  //         );
  //       }
  //     }
  //   }
  //   operation.metadata.args = tx.contract_call_function_args
  //     ? decodeClarityValueList(tx.contract_call_function_args).map((c, fnArgIndex) => {
  //         const functionArgAbi = functionAbi
  //           ? functionAbi.args[fnArgIndex++]
  //           : { name: '', type: undefined };
  //         return {
  //           hex: c.hex,
  //           repr: c.repr,
  //           name: functionArgAbi.name,
  //           type: functionArgAbi.type
  //             ? getTypeString(functionArgAbi.type)
  //             : decodeClarityValueToTypeName(c.hex),
  //         };
  //       })
  //     : [];
  // }

  return operation;
}

function makeSmartContractOperation(tx: StacksTransaction, index: number): Operation {
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

function makeCoinbaseOperation(tx: StacksTransaction, index: number = 0): Operation {
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

function makeTenureChangeOperation(tx: StacksTransaction, index: number = 0): Operation {
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
  tx: StacksTransaction,
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

// function makeStxLockOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbStxLockEvent,
//   index: number
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'stx_lock',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: event.locked_address,
//     },
//     amount: {
//       value: (0n - BigInt(event.locked_amount)).toString(10),
//       currency: makeStxCurrency(),
//     },
//     metadata: {
//       unlock_height: event.unlock_height,
//       locked_address: event.locked_address,
//       contract_name: event.contract_name,
//     },
//   };
// }

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

function makeFtCurrency(
  tokenMetadata: Map<string, TokenMetadata>,
  event: StacksBlockReplayTransactionFtEvent
): Currency {
  const asset_identifier =
    'ft_mint_event' in event
      ? event.ft_mint_event.asset_identifier
      : 'ft_transfer_event' in event
        ? event.ft_transfer_event.asset_identifier
        : 'ft_burn_event' in event
          ? event.ft_burn_event.asset_identifier
          : '';
  const metadata = tokenMetadata.get(asset_identifier);
  return {
    symbol: metadata?.symbol ?? '',
    decimals: metadata?.decimals ?? 0,
    metadata: {
      token_type: 'ft',
      asset_identifier,
    },
  };
}

function makeFtTransferOperations(
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionFtTransferEvent,
  tokenMetadata: Map<string, TokenMetadata>,
  index: number
): Operation[] {
  const currency = makeFtCurrency(tokenMetadata, event);
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

function makeFtMintOperation(
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionFtMintEvent,
  tokenMetadata: Map<string, TokenMetadata>,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'token_mint',
    status: tx.status,
    account: {
      address: event.ft_mint_event.recipient,
    },
    amount: {
      value: event.ft_mint_event.amount,
      currency: makeFtCurrency(tokenMetadata, event),
    },
  };
}

function makeFtBurnOperation(
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionFtBurnEvent,
  tokenMetadata: Map<string, TokenMetadata>,
  index: number
): Operation {
  return {
    operation_identifier: { index },
    type: 'token_burn',
    status: tx.status,
    account: {
      address: event.ft_burn_event.sender,
    },
    amount: {
      value: (0n - BigInt(event.ft_burn_event.amount)).toString(),
      currency: makeFtCurrency(tokenMetadata, event),
    },
  };
}

function makeNftCurrency(
  tokenMetadata: Map<string, TokenMetadata>,
  event: StacksBlockReplayTransactionNftEvent
): Currency {
  const asset_identifier = 'nft_mint_event' in event ? event.nft_mint_event.asset_identifier : '';
  const value = 'nft_mint_event' in event ? event.nft_mint_event.raw_value : '';
  const metadata = tokenMetadata.get(`${asset_identifier}/${value}`);
  return {
    symbol: metadata?.symbol ?? '',
    decimals: metadata?.decimals ?? 0,
    metadata: {
      token_type: 'nft',
      asset_identifier,
      value,
    },
  };
}

function makeNftTransferOperations(
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionNftTransferEvent,
  tokenMetadata: Map<string, TokenMetadata>,
  index: number
): Operation[] {
  const currency = makeNftCurrency(tokenMetadata, event);
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
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionNftMintEvent,
  tokenMetadata: Map<string, TokenMetadata>,
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
      currency: makeNftCurrency(tokenMetadata, event),
    },
  };
}

function makeNftBurnOperation(
  tx: StacksTransaction,
  event: StacksBlockReplayTransactionNftBurnEvent,
  tokenMetadata: Map<string, TokenMetadata>,
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
      currency: makeNftCurrency(tokenMetadata, event),
    },
  };
}

function makeContractEventOperation(
  tx: StacksTransaction,
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

function serializeStacksTransactionOperations(
  tx: StacksTransaction,
  tokenMetadata: Map<string, TokenMetadata>
): Operation[] {
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
      ops.push(makeContractCallOperation(tx, ops.length));
      break;
    case codec.TxPayloadTypeID.PoisonMicroblock:
      // Not supported.
      break;
    case codec.TxPayloadTypeID.Coinbase:
    case codec.TxPayloadTypeID.CoinbaseToAltRecipient:
    case codec.TxPayloadTypeID.NakamotoCoinbase:
      ops.push(makeCoinbaseOperation(tx, ops.length));
      // TODO: Add miner rewards and unlocks
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
      // TODO: stx mint not reported in events from core, see block
      // 0xe1410b8188303242471a57e8bca75c5f61ba8537dfe3d1b92b9cca655e59c16b
      case 'ft_mint_event':
        ops.push(makeFtMintOperation(tx, event, tokenMetadata, ops.length));
        break;
      case 'ft_transfer_event':
        ops.push(...makeFtTransferOperations(tx, event, tokenMetadata, ops.length));
        break;
      case 'ft_burn_event':
        ops.push(makeFtBurnOperation(tx, event, tokenMetadata, ops.length));
        break;
      case 'nft_transfer_event':
        ops.push(...makeNftTransferOperations(tx, event, tokenMetadata, ops.length));
        break;
      case 'nft_mint_event':
        ops.push(makeNftMintOperation(tx, event, tokenMetadata, ops.length));
        break;
      case 'nft_burn_event':
        ops.push(makeNftBurnOperation(tx, event, tokenMetadata, ops.length));
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
  //       case StacksDbEventTypeId.StxLock:
  //         ops.push(makeStxLockOperation(tx, event, ops.length));
  //         break;
  //     }
  //   }
  // }

  return ops;
}
