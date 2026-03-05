import { Block, Transaction, Operation, DecodedClarityValue } from '@stacks/mesh-schemas';
import codec from '@stacks/codec';
import { StacksBlockReplay, StacksBlockReplayTransaction } from '../stacks-rpc/types.js';
import { StacksRpcTransactionNotFoundError } from '../stacks-rpc/errors.js';
import { ApiConfig } from '../api/index.js';
import {
  DecodedStacksTransaction,
  serializeReplayedNakamotoTransaction,
  serializeStacksTransactionOperations,
} from './transactions.js';

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

export function decodeClarityValue(hex: string): DecodedClarityValue {
  const decodedResult = codec.decodeClarityValue(hex);
  return {
    hex: decodedResult.hex,
    repr: decodedResult.repr,
    type: codec.decodeClarityValueToTypeName(hex),
  };
};

/**
 * Serializes a fully replayed Nakamoto block into Mesh API Block format. These blocks are retrieved
 * from the Stacks core RPC API and include all transaction events and fetched via `/block`
 * endpoints.
 * @param replay - The replayed Nakamoto block.
 * @returns The serialized block.
 */
export async function serializeReplayedNakamotoBlock(
  replay: StacksBlockReplay,
  config: ApiConfig
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
 * format. Called via the `/block/transaction` endpoint.
 * @param replay - The replayed Nakamoto block.
 * @param txId - The ID of the transaction to serialize.
 * @returns The serialized transaction.
 */
export async function serializeTransactionFromReplayedNakamotoBlock(
  replay: StacksBlockReplay,
  txId: string,
  config: ApiConfig
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

/**
 * Serializes a decoded transaction into Mesh operations purely from the transaction payload.
 * Unlike {@link serializeStacksTransactionOperations}, this does not require replay events or
 * caches, making it suitable for `/construction/parse` where only the raw transaction hex is
 * available.
 */
export async function serializeDecodedTransactionOperations(
  decodedTx: codec.DecodedTxResult,
  config: ApiConfig
): Promise<Operation[]> {
  const senderAddress = decodedTx.auth.origin_condition.signer.address;
  const fee = Number(BigInt(decodedTx.auth.origin_condition.tx_fee));
  const sponsored = decodedTx.auth.type_id === codec.PostConditionAuthFlag.Sponsored;
  const sponsorAddress = sponsored
    ? (decodedTx.auth as codec.TxAuthSponsored).sponsor_condition.signer.address
    : null;

  const tx: DecodedStacksTransaction = {
    replayedTx: { events: [] } as unknown as StacksBlockReplayTransaction,
    decodedTx,
    fee,
    sponsored,
    senderAddress,
    sponsorAddress,
    nonce: parseInt(decodedTx.auth.origin_condition.nonce),
    status: 'pending',
  };

  return await serializeStacksTransactionOperations(tx, config);
}
