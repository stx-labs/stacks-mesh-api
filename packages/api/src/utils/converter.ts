import { hexToBuffer } from '@stacks/api-toolkit';
import { Block, Transaction, Operation } from '@stacks/mesh-serializer';
import {
  StacksBlockReplay,
  StacksBlockReplayTransaction,
  StacksBlockReplayTransactionPayload,
  StacksBlockReplayTransactionPayloadTenureChange,
  StacksBlockReplayTransactionSpendingCondition,
} from '../stacks-rpc/types.js';

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
 */
export function serializeReplayedNakamotoBlock(replay: StacksBlockReplay): Block {
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
    transactions: replay.transactions.map(tx => serializeReplayedNakamotoTransaction(tx)),
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

function getTransactionSenderData(tx: StacksBlockReplayTransaction): {
  sender_address: string;
  sponsor_address: string | null;
  sender_nonce: number;
  sponsor_nonce: number | null;
  tx_fee: number;
} {
  const getSignerData = (auth: StacksBlockReplayTransactionSpendingCondition) => {
    if ('Singlesig' in auth) {
      return {
        address: auth.Singlesig.signer,
        nonce: auth.Singlesig.nonce,
        tx_fee: auth.Singlesig.tx_fee,
      };
    }
    if ('Multisig' in auth) {
      return {
        address: auth.Multisig.signer,
        nonce: auth.Multisig.nonce,
        tx_fee: auth.Multisig.tx_fee,
      };
    }
    if ('OrderIndependentMultisig' in auth) {
      return {
        address: auth.OrderIndependentMultisig.signer,
        nonce: auth.OrderIndependentMultisig.nonce,
        tx_fee: auth.OrderIndependentMultisig.tx_fee,
      };
    }
    throw new Error(`Unexpected spending condition type: ${JSON.stringify(auth)}`);
  };
  if ('Sponsored' in tx.data.auth) {
    const sender = getSignerData(tx.data.auth.Sponsored[0]);
    const sponsor = getSignerData(tx.data.auth.Sponsored[1]);
    return {
      sender_address: sender.address,
      sender_nonce: sender.nonce,
      sponsor_address: sponsor.address,
      sponsor_nonce: sponsor.nonce,
      tx_fee: sender.tx_fee,
    };
  }
  const sender = getSignerData(tx.data.auth.Standard);
  return {
    sender_address: sender.address,
    sender_nonce: sender.nonce,
    sponsor_address: null,
    sponsor_nonce: null,
    tx_fee: sender.tx_fee,
  };
}

function serializeReplayedNakamotoTransaction(tx: StacksBlockReplayTransaction): Transaction {
  const { sender_address, sponsor_address, tx_fee, sender_nonce, sponsor_nonce } =
    getTransactionSenderData(tx);
  return {
    transaction_identifier: {
      hash: addHexPrefix(tx.txid),
    },
    operations: serializeStacksTransactionOperations(tx),
    metadata: {
      status: serializeTxStatus(tx),
      type: serializeTxType(tx.data.payload),
      sponsored: sponsor_address !== null,
      canonical: true,
      execution_cost: {
        read_count: tx.execution_cost.read_count,
        read_length: tx.execution_cost.read_length,
        runtime: tx.execution_cost.runtime,
        write_count: tx.execution_cost.write_count,
        write_length: tx.execution_cost.write_length,
      },
      fee_rate: tx_fee.toString(),
      nonce: sponsor_nonce ?? sender_nonce,
      position: {
        index: tx.tx_index,
      },
      raw_tx: addHexPrefix(tx.hex),
      result: serializeTxResult(tx),
      sender_address,
      sponsor_address,
      vm_error: tx.vm_error,
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

function serializeTxStatus(tx: StacksBlockReplayTransaction): 'success' {
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

function makeStxCurrency() {
  return {
    symbol: 'STX',
    decimals: 6,
  };
}

// function makeFeeOperation(tx: StacksDbTransaction, index: number = 0): Operation {
//   return {
//     operation_identifier: { index },
//     type: 'fee',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: tx.sponsor_address ?? tx.sender_address,
//     },
//     amount: {
//       currency: makeStxCurrency(),
//       value: (0n - BigInt(tx.fee_rate)).toString(),
//     },
//     metadata: {
//       sponsored: !!tx.sponsor_address,
//     },
//   };
// }

// function makeStxTransferOperations(
//   tx: StacksDbTransaction,
//   index: number,
//   sender: string,
//   receiver: string,
//   amount: string,
//   memo: string | null,
//   options: StacksSerializationOptions
// ): Operation[] {
//   const send: Operation = {
//     operation_identifier: { index },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: sender,
//     },
//     amount: {
//       value: (0n - BigInt(amount)).toString(),
//       currency: makeStxCurrency(),
//     },
//   };
//   const receive: Operation = {
//     operation_identifier: { index: index + 1 },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: receiver,
//     },
//     amount: {
//       value: amount,
//       currency: makeStxCurrency(),
//     },
//   };
//   if (memo) {
//     send.metadata = {
//       memo: options.decodeClarityValues ? parseTransactionMemo(memo) : memo,
//     };
//     receive.metadata = {
//       memo: options.decodeClarityValues ? parseTransactionMemo(memo) : memo,
//     };
//   }
//   return [send, receive];
// }

// function makeContractCallOperation(
//   tx: DecodedTxResult,
//   index: number,
//   options?: StacksSerializationOptions
// ): Operation {
//   const payload = tx.payload as TxPayloadContractCall;
//   const contractId = `${payload.address}.${payload.contract_name}`;
//   const functionName = payload.function_name;
//   const operation: Operation = {
//     operation_identifier: { index },
//     type: 'contract_call',
//     status: 'success', // TODO: Implement status
//     account: {
//       address: tx.auth.origin_condition.signer.address,
//     },
//     metadata: {
//       args: payload.function_args.map(arg => ({
//         hex: arg.hex,
//         repr: arg.repr,
//         name: 'arg.name', // TODO: Implement name
//         type: 'arg.type_id', // TODO: Implement type
//       })),
//       contract_identifier: contractId,
//       function_name: functionName,
//     },
//   };

//   if (options.decodeClarityValues) {
//     let functionAbi: ClarityAbiFunction | undefined;
//     if (tx.abi !== null) {
//       const contractAbi: ClarityAbi = typeof tx.abi === 'string' ? JSON.parse(tx.abi) : tx.abi;
//       if (contractAbi) {
//         functionAbi = contractAbi.functions.find(fn => fn.name === functionName);
//         if (!functionAbi) {
//           throw new Error(
//             `Could not find function name "${functionName}" in ABI for ${contractId}`
//           );
//         }
//       }
//     }
//     operation.metadata.args = tx.contract_call_function_args
//       ? decodeClarityValueList(tx.contract_call_function_args).map((c, fnArgIndex) => {
//           const functionArgAbi = functionAbi
//             ? functionAbi.args[fnArgIndex++]
//             : { name: '', type: undefined };
//           return {
//             hex: c.hex,
//             repr: c.repr,
//             name: functionArgAbi.name,
//             type: functionArgAbi.type
//               ? getTypeString(functionArgAbi.type)
//               : decodeClarityValueToTypeName(c.hex),
//           };
//         })
//       : [];
//   }

//   return operation;
// }

// function makeSmartContractOperation(
//   tx: DecodedTxResult,
//   index: number,
//   options?: StacksSerializationOptions
// ): Operation {
//   const address = tx.auth.origin_condition.signer.address;
//   const payload = tx.payload as TxPayloadSmartContract | TxPayloadVersionedSmartContract;
//   return {
//     operation_identifier: { index },
//     type: 'contract_deploy',
//     status: 'success', // TODO: Implement status
//     account: {
//       address,
//     },
//     metadata: {
//       contract_identifier: `${address}.${payload.contract_name}`,
//       source_code: options?.includeContractSourceCode ? payload.code_body : undefined,
//       clarity_version:
//         (payload as TxPayloadVersionedSmartContract).clarity_version ?? ClarityVersion.Clarity1,
//       abi: undefined, // TODO: Implement abi
//     },
//   };
// }

// function makeCoinbaseOperation(tx: StacksDbTransaction, index: number = 0): Operation {
//   return {
//     operation_identifier: { index },
//     type: 'coinbase',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(tx.sender_address),
//     },
//     metadata: {
//       alt_recipient: tx.coinbase_alt_recipient ?? null,
//       vrf_proof: tx.coinbase_vrf_proof ?? null,
//     },
//   };
// }

function makeTenureChangeOperation(
  tx: StacksBlockReplayTransaction,
  payload: StacksBlockReplayTransactionPayloadTenureChange,
  index: number = 0
): Operation {
  const getCause = (cause: string) => {
    switch (cause) {
      case 'BlockFound':
        return 'block_found';
      case 'Extended':
        return 'extended';
      case 'ExtendedRuntime':
        return 'extended_runtime';
      case 'ExtendedReadCount':
        return 'extended_read_count';
      case 'ExtendedReadLength':
        return 'extended_read_length';
      case 'ExtendedWriteCount':
        return 'extended_write_count';
      case 'ExtendedWriteLength':
        return 'extended_write_length';
      default:
        throw new Error(`Unexpected tenure change cause: ${cause}`);
    }
  };
  return {
    operation_identifier: { index },
    type: 'tenure_change',
    status: serializeTxStatus(tx),
    metadata: {
      tenure_consensus_hash: addHexPrefix(payload.TenureChange.tenure_consensus_hash),
      prev_tenure_consensus_hash: addHexPrefix(payload.TenureChange.prev_tenure_consensus_hash),
      burn_view_consensus_hash: addHexPrefix(payload.TenureChange.burn_view_consensus_hash),
      previous_tenure_blocks: payload.TenureChange.previous_tenure_blocks,
      previous_tenure_end: addHexPrefix(payload.TenureChange.previous_tenure_end),
      cause: getCause(payload.TenureChange.cause),
      pubkey_hash: addHexPrefix(payload.TenureChange.pubkey_hash),
    },
  };
}

// function makePoisonMicroblockOperation(
//   tx: StacksDbTransaction,
//   index: number = 0
// ): Operation {
//   return {
//     operation_identifier: { index },
//     type: 'poison_microblock',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(tx.sender_address),
//     },
//     metadata: {
//       microblock_header_1: unwrap(tx.poison_microblock_header_1),
//       microblock_header_2: unwrap(tx.poison_microblock_header_2),
//     },
//   };
// }

// function makeStxBurnOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbStxEvent,
//   index: number
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'token_burn',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.sender),
//     },
//     amount: {
//       value: (0n - BigInt(event.amount)).toString(),
//       currency: makeStxCurrency(),
//     },
//   };
// }

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

// function makeFtCurrency(
//   tokenMetadata: Map<string, TokenMetadata>,
//   event: StacksDbFtEvent
// ): StacksCurrency {
//   const metadata = tokenMetadata.get(event.asset_identifier);
//   return {
//     symbol: metadata?.symbol ?? '',
//     decimals: metadata?.decimals ?? 0,
//     metadata: {
//       token_type: 'ft',
//       asset_identifier: event.asset_identifier,
//     },
//   };
// }

// function makeFtTransferOperations(
//   tx: StacksDbTransaction,
//   event: StacksDbFtEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
//   index: number
// ): StacksOperation[] {
//   const currency = makeFtCurrency(tokenMetadata, event);
//   const send: StacksOperation = {
//     operation_identifier: { index },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.sender),
//     },
//     amount: {
//       value: (0n - BigInt(event.amount)).toString(),
//       currency,
//     },
//   };
//   const receive: StacksOperation = {
//     operation_identifier: { index: index + 1 },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.recipient),
//     },
//     amount: {
//       value: event.amount,
//       currency,
//     },
//   };
//   return [send, receive];
// }

// function makeFtMintOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbFtEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
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
//       currency: makeFtCurrency(tokenMetadata, event),
//     },
//   };
// }

// function makeFtBurnOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbFtEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
//   index: number
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'token_burn',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.sender),
//     },
//     amount: {
//       value: event.amount.toString(),
//       currency: makeFtCurrency(tokenMetadata, event),
//     },
//   };
// }

// function makeNftCurrency(
//   tokenMetadata: Map<string, TokenMetadata>,
//   event: StacksDbNftEvent
// ): StacksCurrency {
//   const metadata = tokenMetadata.get(`${event.asset_identifier}/${event.value}`);
//   return {
//     symbol: metadata?.symbol ?? '',
//     decimals: metadata?.decimals ?? 0,
//     metadata: {
//       token_type: 'nft',
//       asset_identifier: event.asset_identifier,
//       value: event.value,
//     },
//   };
// }

// function makeNftTransferOperations(
//   tx: StacksDbTransaction,
//   event: StacksDbNftEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
//   index: number
// ): StacksOperation[] {
//   const currency = makeNftCurrency(tokenMetadata, event);
//   const send: StacksOperation = {
//     operation_identifier: { index },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.sender),
//     },
//     amount: {
//       value: '-1',
//       currency,
//     },
//   };
//   const receive: StacksOperation = {
//     operation_identifier: { index: index + 1 },
//     type: 'token_transfer',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.recipient),
//     },
//     amount: {
//       value: '1',
//       currency,
//     },
//   };
//   return [send, receive];
// }

// function makeNftMintOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbNftEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
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
//       value: '1',
//       currency: makeNftCurrency(tokenMetadata, event),
//     },
//   };
// }

// function makeNftBurnOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbNftEvent,
//   tokenMetadata: Map<string, TokenMetadata>,
//   index: number
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'token_burn',
//     status: serializeTxStatus(tx.status),
//     account: {
//       address: unwrap(event.sender),
//     },
//     amount: {
//       value: '-1',
//       currency: makeNftCurrency(tokenMetadata, event),
//     },
//   };
// }

// function makeContractLogOperation(
//   tx: StacksDbTransaction,
//   event: StacksDbSmartContractEvent,
//   index: number,
//   options: StacksSerializationOptions
// ): StacksOperation {
//   return {
//     operation_identifier: { index },
//     type: 'contract_log',
//     status: serializeTxStatus(tx.status),
//     metadata: {
//       value: options.decodeClarityValues
//         ? {
//             hex: event.value,
//             repr: decodeClarityValueToRepr(event.value),
//           }
//         : event.value,
//       contract_identifier: event.contract_identifier,
//       topic: event.topic,
//     },
//   };
// }

function serializeStacksTransactionOperations(tx: StacksBlockReplayTransaction): Operation[] {
  const ops: Operation[] = [];

  if ('TenureChange' in tx.data.payload) {
    ops.push(makeTenureChangeOperation(tx, tx.data.payload));
  }
  // Add operations from transaction data.
  // switch (tx.payload.type_id) {
  //   case TxPayloadTypeID.TokenTransfer:
  //     ops.push(makeFeeOperation(tx));
  //     ops.push(
  //       ...makeStxTransferOperations(
  //         tx,
  //         ops.length,
  //         tx.sender_address,
  //         unwrap(tx.token_transfer_recipient_address),
  //         unwrap(tx.token_transfer_amount),
  //         tx.token_transfer_memo,
  //         options
  //       )
  //     );
  //     break;
  //   case TxPayloadTypeID.SmartContract:
  //   case TxPayloadTypeID.VersionedSmartContract:
  //     ops.push(makeFeeOperation(tx));
  //     ops.push(makeSmartContractOperation(tx, ops.length, options));
  //     break;
  //   case TxPayloadTypeID.ContractCall:
  //     ops.push(makeFeeOperation(tx));
  //     ops.push(makeContractCallOperation(tx, ops.length, options));
  //     break;
  //   case TxPayloadTypeID.PoisonMicroblock:
  //     ops.push(makePoisonMicroblockOperation(tx));
  //     break;
  //   case TxPayloadTypeID.Coinbase:
  //   case TxPayloadTypeID.CoinbaseToAltRecipient:
  //   case TxPayloadTypeID.NakamotoCoinbase:
  //     ops.push(makeCoinbaseOperation(tx));
  //     // TODO: Add miner rewards and unlocks
  //     break;
  // }

  // Add operations from transaction events.
  // TODO: Complete all event types.
  // if (transaction.events.length) {
  //   for (const event of transaction.events) {
  //     switch (event.event_type) {
  //       case StacksDbEventTypeId.StxAsset:
  //         switch (event.asset_event_type_id) {
  //           case StacksDbAssetEventTypeId.Transfer:
  //             if (tx.type_id == StacksDbTxTypeId.TokenTransfer) {
  //               // We've already added these operations above
  //               break;
  //             }
  //             // TODO: Handle `send_many` and `send_many_memo`
  //             ops.push(
  //               ...makeStxTransferOperations(
  //                 tx,
  //                 ops.length,
  //                 unwrap(event.sender),
  //                 unwrap(event.recipient),
  //                 unwrap(event.amount),
  //                 event.memo,
  //                 options
  //               )
  //             );
  //             break;
  //           case StacksDbAssetEventTypeId.Mint:
  //             ops.push(makeStxMintOperation(tx, event, ops.length));
  //             break;
  //           case StacksDbAssetEventTypeId.Burn:
  //             ops.push(makeStxBurnOperation(tx, event, ops.length));
  //             break;
  //         }
  //         break;
  //       case StacksDbEventTypeId.FungibleTokenAsset:
  //         switch (event.asset_event_type_id) {
  //           case StacksDbAssetEventTypeId.Transfer:
  //             ops.push(...makeFtTransferOperations(tx, event, tokenMetadata, ops.length));
  //             break;
  //           case StacksDbAssetEventTypeId.Mint:
  //             ops.push(makeFtMintOperation(tx, event, tokenMetadata, ops.length));
  //             break;
  //           case StacksDbAssetEventTypeId.Burn:
  //             ops.push(makeFtBurnOperation(tx, event, tokenMetadata, ops.length));
  //             break;
  //         }
  //         break;
  //       case StacksDbEventTypeId.NonFungibleTokenAsset:
  //         switch (event.asset_event_type_id) {
  //           case StacksDbAssetEventTypeId.Transfer:
  //             ops.push(...makeNftTransferOperations(tx, event, tokenMetadata, ops.length));
  //             break;
  //           case StacksDbAssetEventTypeId.Mint:
  //             ops.push(makeNftMintOperation(tx, event, tokenMetadata, ops.length));
  //             break;
  //           case StacksDbAssetEventTypeId.Burn:
  //             ops.push(makeNftBurnOperation(tx, event, tokenMetadata, ops.length));
  //             break;
  //         }
  //         break;
  //       case StacksDbEventTypeId.SmartContractLog:
  //         ops.push(makeContractLogOperation(tx, event, ops.length, options));
  //         break;
  //       case StacksDbEventTypeId.StxLock:
  //         ops.push(makeStxLockOperation(tx, event, ops.length));
  //         break;
  //     }
  //   }
  // }

  return ops;
}

// function buildOperationsFromDecodedTx(tx: DecodedTxResult, currency: Currency): Operation[] {
//   const operations: Operation[] = [];
//   let operationIndex = 0;
//   const status = OPERATION_STATUS_SUCCESS;
//   const senderAddress = getSenderAddress(tx);
//   const fee = getTxFee(tx);

//   // Add fee operation (sender pays fee)
//   if (BigInt(fee) > 0n) {
//     operations.push({
//       operation_identifier: { index: operationIndex++ },
//       type: 'fee',
//       status,
//       account: {
//         address: senderAddress,
//       },
//       amount: {
//         value: `-${fee}`,
//         currency,
//       },
//     });
//   }

//   // Handle different payload types
//   const payload = tx.payload;

//   switch (payload.type_id) {
//     case TxPayloadTypeID.TokenTransfer: {
//       const transfer = payload as TxPayloadTokenTransfer;
//       const recipientAddress = getRecipientAddress(transfer.recipient);

//       // Debit from sender
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'transfer',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         amount: {
//           value: `-${transfer.amount}`,
//           currency,
//         },
//       });

//       // Credit to recipient
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         related_operations: [{ index: operationIndex - 2 }],
//         type: 'transfer',
//         status,
//         account: {
//           address: recipientAddress,
//         },
//         amount: {
//           value: transfer.amount,
//           currency,
//         },
//         metadata: {
//           memo: decodeMemo(transfer.memo_hex),
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.Coinbase: {
//       const coinbase = payload as TxPayloadCoinbase;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'coinbase',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         metadata: {
//           coinbase_data: coinbase.payload_buffer,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.CoinbaseToAltRecipient: {
//       const coinbase = payload as TxPayloadCoinbaseToAltRecipient;
//       const recipient = getRecipientAddress(coinbase.recipient);
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'coinbase',
//         status,
//         account: {
//           address: recipient,
//         },
//         metadata: {
//           coinbase_data: coinbase.payload_buffer,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.NakamotoCoinbase: {
//       const coinbase = payload as TxPayloadNakamotoCoinbase;
//       const recipient = coinbase.recipient
//         ? getRecipientAddress(coinbase.recipient)
//         : senderAddress;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'coinbase',
//         status,
//         account: {
//           address: recipient,
//         },
//         metadata: {
//           coinbase_data: coinbase.payload_buffer,
//           vrf_proof: coinbase.vrf_proof,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.SmartContract: {
//       const contract = payload as TxPayloadSmartContract;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'smart_contract',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         metadata: {
//           contract_id: `${senderAddress}.${contract.contract_name}`,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.VersionedSmartContract: {
//       const contract = payload as TxPayloadVersionedSmartContract;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'smart_contract',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         metadata: {
//           contract_id: `${senderAddress}.${contract.contract_name}`,
//           clarity_version: contract.clarity_version,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.ContractCall: {
//       const call = payload as TxPayloadContractCall;
//       const contractId = `${call.address}.${call.contract_name}`;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'contract_call',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         metadata: {
//           contract_id: contractId,
//           function_name: call.function_name,
//           function_args: call.function_args.map((arg) => ({
//             hex: arg.hex,
//             repr: arg.repr,
//           })),
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.TenureChange: {
//       const tenure = payload as TxPayloadTenureChange;
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'tenure_change',
//         status,
//         account: {
//           address: senderAddress,
//         },
//         metadata: {
//           tenure_consensus_hash: tenure.tenure_consensus_hash,
//           prev_tenure_consensus_hash: tenure.prev_tenure_consensus_hash,
//           burn_view_consensus_hash: tenure.burn_view_consensus_hash,
//           previous_tenure_end: tenure.previous_tenure_end,
//           previous_tenure_blocks: tenure.previous_tenure_blocks,
//           cause: tenure.cause,
//           pubkey_hash: tenure.pubkey_hash,
//         },
//       });
//       break;
//     }

//     case TxPayloadTypeID.PoisonMicroblock: {
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'poison_microblock',
//         status,
//         account: {
//           address: senderAddress,
//         },
//       });
//       break;
//     }

//     default:
//       // Unknown payload type - create generic operation
//       operations.push({
//         operation_identifier: { index: operationIndex++ },
//         type: 'unknown',
//         status,
//         account: {
//           address: senderAddress,
//         },
//       });
//   }

//   return operations;
// }

// function getSenderAddress(tx: DecodedTxResult): string {
//   const originCondition = tx.auth.origin_condition;
//   return originCondition.signer.address;
// }

// function getTxFee(tx: DecodedTxResult): string {
//   return tx.auth.origin_condition.tx_fee;
// }

// function getNonce(tx: DecodedTxResult): string {
//   return tx.auth.origin_condition.nonce;
// }

// function getRecipientAddress(
//   recipient:
//     | { type_id: number; address: string; contract_name?: string }
//     | null
// ): string {
//   if (!recipient) {
//     return '';
//   }
//   if (recipient.type_id === PrincipalTypeID.Contract && recipient.contract_name) {
//     return `${recipient.address}.${recipient.contract_name}`;
//   }
//   return recipient.address;
// }

// /**
//  * Get the human-readable name for a transaction payload type.
//  */
// export function getPayloadTypeName(typeId: TxPayloadTypeIDType): string {
//   switch (typeId) {
//     case TxPayloadTypeID.TokenTransfer:
//       return 'token_transfer';
//     case TxPayloadTypeID.SmartContract:
//       return 'smart_contract';
//     case TxPayloadTypeID.VersionedSmartContract:
//       return 'versioned_smart_contract';
//     case TxPayloadTypeID.ContractCall:
//       return 'contract_call';
//     case TxPayloadTypeID.Coinbase:
//       return 'coinbase';
//     case TxPayloadTypeID.CoinbaseToAltRecipient:
//       return 'coinbase_to_alt_recipient';
//     case TxPayloadTypeID.NakamotoCoinbase:
//       return 'nakamoto_coinbase';
//     case TxPayloadTypeID.TenureChange:
//       return 'tenure_change';
//     case TxPayloadTypeID.PoisonMicroblock:
//       return 'poison_microblock';
//     default:
//       return 'unknown';
//   }
// }

// function decodeMemo(memoHex: string): string {
//   try {
//     // Remove 0x prefix if present
//     const hex = memoHex.startsWith('0x') ? memoHex.slice(2) : memoHex;
//     return memoToString(Buffer.from(hex, 'hex'));
//   } catch {
//     return memoHex;
//   }
// }
