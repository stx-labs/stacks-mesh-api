import { Block, Transaction, Operation, DecodedClarityValue } from '@stacks/mesh-schemas';
import codec, {
  PostConditionAuthFlag,
  type DecodedTxResult,
  type TxAuthSponsored,
} from '@stacks/codec';
import { StacksRpcTransactionNotFoundError } from '../stacks-rpc/errors.js';
import { ApiConfig } from '../api/index.js';
import {
  DecodedStacksTransaction,
  getDeclaredTxFee,
  prefetchBlockMetadata,
  serializeReplayedNakamotoTransaction,
  serializeStacksTransactionOperations,
} from './transactions.js';
import type { BlockReplay, BlockReplayTransaction } from '@stacks/rpc-client';
import { selectDisplayBlockHash } from '../utils/block-hash.js';

export function removeHexPrefix(hex: string): string {
  if (/^0x/i.test(hex)) {
    return hex.slice(2);
  }
  return hex;
}

export function addHexPrefix(hex: string): string {
  if (!/^0x/i.test(hex)) {
    return `0x${hex}`;
  }
  return `0x${hex.slice(2)}`;
}

export function decodeClarityValue(hex: string): DecodedClarityValue {
  const normalizedHex = removeHexPrefix(hex);
  const decodedResult = codec.decodeClarityValue(normalizedHex);
  return {
    hex: addHexPrefix(decodedResult.hex),
    repr: decodedResult.repr,
    type: codec.decodeClarityValueToTypeName(normalizedHex),
  };
}

/**
 * Serializes a fully replayed Nakamoto block into Mesh API Block format. These blocks are retrieved
 * from the Stacks core RPC API and include all transaction events and fetched via `/block`
 * endpoints.
 * @param replay - The replayed Nakamoto block.
 * @param config - The API config (selects which hash to display).
 * @param parentBlockHash - The parent block's `block_hash`, required in `block_hash` mode (the
 *   replay only carries the parent's index block hash). Ignored in `index_block_hash` mode.
 * @returns The serialized block.
 */
export async function serializeReplayedNakamotoBlock(
  replay: BlockReplay,
  config: ApiConfig,
  parentBlockHash?: string
): Promise<Block> {
  const blockHeight = replay.block_height;
  const parentHash =
    config.blockHashMode === 'block_hash'
      ? // Fall back to the parent index hash only if the parent hash couldn't be resolved
        // (e.g. genesis has no parent block to fetch).
        (parentBlockHash ?? addHexPrefix(replay.parent_block_id))
      : addHexPrefix(replay.parent_block_id);
  const block: Block = {
    block_identifier: {
      index: blockHeight,
      hash: selectDisplayBlockHash(config.blockHashMode, {
        indexBlockHash: addHexPrefix(replay.block_id),
        blockHash: addHexPrefix(replay.block_hash),
      }),
    },
    parent_block_identifier: {
      index: blockHeight > 0 ? blockHeight - 1 : 0,
      hash: parentHash,
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
  // Decode every transaction once, then warm the ABI/token caches for the whole block concurrently
  // so the serial serialization below hits warm caches instead of blocking on per-event node calls.
  const decodedTxs = replay.transactions.map(tx => codec.decodeTransaction(tx.hex));
  await prefetchBlockMetadata(replay.transactions, decodedTxs, config);

  for (let i = 0; i < replay.transactions.length; i++) {
    // TODO: `tx_index` does not work from Stacks core (it's always 0).
    const tx = replay.transactions[i];
    block.metadata!.execution_cost!.read_count += tx.execution_cost.read_count;
    block.metadata!.execution_cost!.read_length += tx.execution_cost.read_length;
    block.metadata!.execution_cost!.runtime += tx.execution_cost.runtime;
    block.metadata!.execution_cost!.write_count += tx.execution_cost.write_count;
    block.metadata!.execution_cost!.write_length += tx.execution_cost.write_length;
    const serializedTx = await serializeReplayedNakamotoTransaction(tx, decodedTxs[i], i, config);
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
  replay: BlockReplay,
  txId: string,
  config: ApiConfig
): Promise<Transaction> {
  const normalizedTxId = addHexPrefix(txId);
  // TODO: `tx_index` does not work from Stacks core (it's always 0). We need to traverse the entire
  // array to determine the index.
  let index = 0;
  for (const tx of replay.transactions) {
    if (addHexPrefix(tx.txid) === normalizedTxId) {
      return serializeReplayedNakamotoTransaction(
        tx,
        codec.decodeTransaction(tx.hex),
        index,
        config
      );
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
  decodedTx: DecodedTxResult,
  config: ApiConfig
): Promise<Operation[]> {
  const senderAddress = decodedTx.auth.origin_condition.signer.address;
  const fee = getDeclaredTxFee(decodedTx);
  const sponsored = decodedTx.auth.type_id === PostConditionAuthFlag.Sponsored;
  const sponsorAddress = sponsored
    ? (decodedTx.auth as TxAuthSponsored).sponsor_condition.signer.address
    : null;

  const tx: DecodedStacksTransaction = {
    replayedTx: { events: [] } as unknown as BlockReplayTransaction,
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
