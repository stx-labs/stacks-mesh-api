import { BlockReplay, CoreRpcClient, CoreRpcError, NodeInfo } from '@stacks/rpc-client';
import { StacksRpcBlockNotFoundError, StacksRpcSmartContractError } from './errors.js';
import { BigNumber } from 'bignumber.js';
import codec, {
  ClarityTypeID,
  type ClarityValue,
  type ClarityValueUInt,
  type DecodedNakamotoBlockResult,
} from '@stacks/codec';
import { addHexPrefix, removeHexPrefix } from '../serializers/index.js';
import { BlockIdentifier } from '@stacks/mesh-schemas';
import type { BlockHashMode } from '../utils/block-hash.js';
import { StacksRpcInvalidBlockIdentifierError } from './errors.js';

/**
 * Fetch a decoded Nakamoto block header by height. Returns both hashes (they always come together
 * from a decoded header) so callers can validate an input hash and/or choose which to display.
 */
async function fetchNakamotoBlockByHeight(
  rpcClient: CoreRpcClient,
  height: number
): Promise<DecodedNakamotoBlockResult> {
  const bytes = (await rpcClient.request('GET', '/v3/blocks/height/{block_height}', {
    params: { path: { block_height: height } },
    parseAs: 'arrayBuffer',
  })) as unknown as ArrayBuffer;
  return codec.decodeNakamotoBlock(Buffer.from(bytes));
}

/**
 * Fetch a decoded Nakamoto block header by its index block hash.
 */
async function fetchNakamotoBlockByIndexHash(
  rpcClient: CoreRpcClient,
  indexBlockHash: string
): Promise<DecodedNakamotoBlockResult> {
  const bytes = (await rpcClient.request('GET', '/v3/blocks/{block_id}', {
    params: { path: { block_id: removeHexPrefix(indexBlockHash) } },
    parseAs: 'arrayBuffer',
  })) as unknown as ArrayBuffer;
  return codec.decodeNakamotoBlock(Buffer.from(bytes));
}

/**
 * The block hash a request refers to, per the configured display mode: `block_hash` in block_hash
 * mode, otherwise `index_block_hash`. Used to validate an input hash against a resolved header.
 */
function headerHashForMode(
  header: DecodedNakamotoBlockResult['header'],
  mode: BlockHashMode
): string {
  return mode === 'block_hash' ? header.block_hash : header.index_block_hash;
}

/**
 * The block hash of the parent block, for display in `block_hash` mode. Fetches the parent header
 * (the replay carries only the parent's index block hash). Returns `null` if there is no parent
 * (genesis) so callers can fall back to a constant.
 */
export async function getParentBlockHash(
  rpcClient: CoreRpcClient,
  parentIndexBlockHash: string
): Promise<string | null> {
  try {
    const parent = await fetchNakamotoBlockByIndexHash(rpcClient, parentIndexBlockHash);
    return addHexPrefix(parent.header.block_hash);
  } catch (error) {
    if (error instanceof CoreRpcError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Resolve a (partial) block identifier from a request to the `index_block_hash` the node needs.
 *
 * Node RPCs only key on index_block_hash or height, so:
 * - When `index` (height) is present it is authoritative and mode-independent; the block hash (if
 *   also supplied) is validated against the resolved header.
 * - When only a `hash` is present: in `index_block_hash` mode the hash *is* the index block hash. In
 *   `block_hash` mode the node cannot resolve a bare block hash — the caller must include `index`.
 */
async function resolveIndexBlockHash(
  rpcClient: CoreRpcClient,
  blockIdentifier: Partial<BlockIdentifier>,
  mode: BlockHashMode
): Promise<{ indexBlockHash: string; block?: DecodedNakamotoBlockResult }> {
  if (blockIdentifier.index != null) {
    // The height fetch already yields the decoded block; return it so callers that need the block
    // itself (e.g. account balance) don't fetch it a second time.
    const block = await fetchNakamotoBlockByHeight(rpcClient, blockIdentifier.index);
    if (blockIdentifier.hash) {
      const expected = addHexPrefix(headerHashForMode(block.header, mode)).toLowerCase();
      const provided = addHexPrefix(blockIdentifier.hash).toLowerCase();
      if (provided !== expected) {
        throw new StacksRpcInvalidBlockIdentifierError(
          `hash ${blockIdentifier.hash} does not match the block at index ${blockIdentifier.index}`
        );
      }
    }
    return { indexBlockHash: block.header.index_block_hash, block };
  }
  if (blockIdentifier.hash) {
    if (mode === 'block_hash') {
      throw new StacksRpcInvalidBlockIdentifierError(
        'in block_hash mode a block lookup by hash must also include the block index'
      );
    }
    // index_block_hash mode: the supplied hash is already the index block hash.
    return { indexBlockHash: blockIdentifier.hash };
  }
  throw new StacksRpcInvalidBlockIdentifierError('a block index or hash is required');
}

/**
 * Get the chain tip Nakamoto block from the RPC client.
 * @param rpcClient - The RPC client.
 * @returns The chain tip Nakamoto block.
 */
export async function getChainTipNakamotoBlock(
  rpcClient: CoreRpcClient
): Promise<{ decodedBlock: DecodedNakamotoBlockResult; nodeInfo: NodeInfo }> {
  // Node info does not contain the index block hash, so we need a secondary request to fetch it
  // from the nakamoto block at the chain tip height.
  const nodeInfo = await rpcClient.request('GET', '/v2/info');
  const blockBytes = (await rpcClient.request('GET', '/v3/blocks/height/{block_height}', {
    params: { path: { block_height: nodeInfo.stacks_tip_height } },
    parseAs: 'arrayBuffer',
  })) as unknown as ArrayBuffer;
  return {
    decodedBlock: codec.decodeNakamotoBlock(Buffer.from(blockBytes)),
    nodeInfo,
  };
}

/**
 * Get a decoded Nakamoto block from a partial block identifier.
 * @param rpcClient - The RPC client.
 * @param blockIdentifier - The block identifier.
 * @param mode - How an input hash is interpreted (see {@link resolveIndexBlockHash}).
 * @returns The decoded Nakamoto block.
 */
export async function getNakamotoBlockFromPartialBlockIdentifier(
  rpcClient: CoreRpcClient,
  blockIdentifier: Partial<BlockIdentifier>,
  mode: BlockHashMode
): Promise<DecodedNakamotoBlockResult> {
  try {
    const { indexBlockHash, block } = await resolveIndexBlockHash(rpcClient, blockIdentifier, mode);
    return block ?? (await fetchNakamotoBlockByIndexHash(rpcClient, indexBlockHash));
  } catch (error) {
    if (error instanceof CoreRpcError && error.status === 404) {
      throw new StacksRpcBlockNotFoundError(
        blockIdentifier.hash ?? blockIdentifier.index!.toString()
      );
    }
    throw error;
  }
}

/**
 * Get a replayed Nakamoto block from a partial block identifier.
 * @param rpcClient - The RPC client.
 * @param blockIdentifier - The block identifier.
 * @param mode - How an input hash is interpreted (see {@link resolveIndexBlockHash}).
 * @returns The replayed Nakamoto block.
 */
export async function getReplayedNakamotoBlockFromPartialBlockIdentifier(
  rpcClient: CoreRpcClient,
  blockIdentifier: Partial<BlockIdentifier>,
  mode: BlockHashMode
): Promise<BlockReplay> {
  try {
    const { indexBlockHash } = await resolveIndexBlockHash(rpcClient, blockIdentifier, mode);
    return await rpcClient.request('GET', '/v3/blocks/replay/{block_id}', {
      params: { path: { block_id: removeHexPrefix(indexBlockHash) } },
    });
  } catch (error) {
    if (error instanceof CoreRpcError && error.status === 404) {
      throw new StacksRpcBlockNotFoundError(
        blockIdentifier.hash ?? blockIdentifier.index!.toString()
      );
    }
    throw error;
  }
}

/**
 * Call a read-only function on a contract.
 * @param rpcClient - The RPC client to use.
 * @param contractAddress - The address of the contract to call.
 * @param contractName - The name of the contract to call.
 * @param functionName - The name of the function to call.
 * @param args - The arguments to pass to the function.
 * @param sender - The sender of the transaction.
 * @param sponsor - The sponsor of the transaction.
 * @returns The result of the function call.
 */
export async function callReadOnlyFunction(
  rpcClient: CoreRpcClient,
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[],
  sender: string,
  sponsor?: string
): Promise<string> {
  const result = await rpcClient.request(
    'POST',
    '/v2/contracts/call-read/{deployer_address}/{contract_name}/{function_name}',
    {
      params: {
        path: {
          deployer_address: contractAddress,
          contract_name: contractName,
          function_name: functionName,
        },
      },
      body: { arguments: args, sender, sponsor },
    }
  );
  if (result.okay) return result.result;
  throw new StacksRpcSmartContractError(result.cause);
}

export async function readStringFromContract(
  rpcClient: CoreRpcClient,
  contractAddress: string,
  contractName: string,
  functionName: string,
  sender: string,
  functionArgs: string[] = []
): Promise<string> {
  const result = await callReadOnlyFunction(
    rpcClient,
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    sender
  );
  return checkAndParseString(result);
}

export async function readUIntFromContract(
  rpcClient: CoreRpcClient,
  contractAddress: string,
  contractName: string,
  functionName: string,
  sender: string,
  functionArgs: string[] = []
): Promise<number> {
  const result = await callReadOnlyFunction(
    rpcClient,
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    sender
  );
  const uintVal = checkAndParseUintCV(result);
  try {
    return BigNumber(uintVal.value).toNumber();
  } catch (error) {
    throw new StacksRpcSmartContractError(`Invalid uint value '${uintVal.value}'`);
  }
}

function unwrapClarityType(clarityValue: ClarityValue): ClarityValue {
  let unwrappedClarityValue: ClarityValue = clarityValue;
  while (
    unwrappedClarityValue.type_id === ClarityTypeID.ResponseOk ||
    unwrappedClarityValue.type_id === ClarityTypeID.OptionalSome
  ) {
    unwrappedClarityValue = unwrappedClarityValue.value;
  }
  return unwrappedClarityValue;
}

function checkAndParseUintCV(result: string): ClarityValueUInt {
  const responseCV = codec.decodeClarityValue(result);
  const unwrappedClarityValue = unwrapClarityType(responseCV);
  if (unwrappedClarityValue.type_id === ClarityTypeID.UInt) {
    return unwrappedClarityValue;
  }
  throw new StacksRpcSmartContractError(
    `Unexpected Clarity type '${unwrappedClarityValue.type_id}' while unwrapping uint`
  );
}

function checkAndParseString(result: string): string {
  const responseCV = codec.decodeClarityValue(result);
  const unwrappedClarityValue = unwrapClarityType(responseCV);
  if (
    unwrappedClarityValue.type_id === ClarityTypeID.StringAscii ||
    unwrappedClarityValue.type_id === ClarityTypeID.StringUtf8
  ) {
    return unwrappedClarityValue.data;
  }
  throw new StacksRpcSmartContractError(
    `Unexpected Clarity type '${unwrappedClarityValue.type_id}' while unwrapping string`
  );
}
