import { BlockReplay, CoreRpcClient, CoreRpcError, NodeInfo } from '@stacks/rpc-client';
import { StacksRpcBlockNotFoundError, StacksRpcSmartContractError } from './errors.js';
import { BigNumber } from 'bignumber.js';
import codec from '@stacks/codec';
import { removeHexPrefix } from '../serializers/index.js';
import { BlockIdentifier } from '@stacks/mesh-schemas';

/**
 * Get the chain tip Nakamoto block from the RPC client.
 * @param rpcClient - The RPC client.
 * @returns The chain tip Nakamoto block.
 */
export async function getChainTipNakamotoBlock(
  rpcClient: CoreRpcClient
): Promise<{ decodedBlock: codec.DecodedNakamotoBlockResult; nodeInfo: NodeInfo }> {
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
 * @returns The decoded Nakamoto block.
 */
export async function getNakamotoBlockFromPartialBlockIdentifier(
  rpcClient: CoreRpcClient,
  blockIdentifier: Partial<BlockIdentifier>
): Promise<codec.DecodedNakamotoBlockResult | null> {
  try {
    if (blockIdentifier.index) {
      const bytes = (await rpcClient.request('GET', '/v3/blocks/height/{block_height}', {
        params: { path: { block_height: blockIdentifier.index } },
        parseAs: 'arrayBuffer',
      })) as unknown as ArrayBuffer;
      return codec.decodeNakamotoBlock(Buffer.from(bytes));
    }
    if (blockIdentifier.hash) {
      const bytes = (await rpcClient.request('GET', '/v3/blocks/{block_id}', {
        params: { path: { block_id: removeHexPrefix(blockIdentifier.hash) } },
        parseAs: 'arrayBuffer',
      })) as unknown as ArrayBuffer;
      return codec.decodeNakamotoBlock(Buffer.from(bytes));
    }
    return null;
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
 * @returns The replayed Nakamoto block.
 */
export async function getReplayedNakamotoBlockFromPartialBlockIdentifier(
  rpcClient: CoreRpcClient,
  blockIdentifier: Partial<BlockIdentifier>
): Promise<BlockReplay> {
  try {
    let indexBlockHash = blockIdentifier.hash;
    // If the block identifier is a height, fetch and decode the block header to get the index block
    // hash.
    if (!indexBlockHash) {
      const bytes = (await rpcClient.request('GET', '/v3/blocks/height/{block_height}', {
        params: { path: { block_height: blockIdentifier.index! } },
        parseAs: 'arrayBuffer',
      })) as unknown as ArrayBuffer;
      const decodedBlock = codec.decodeNakamotoBlock(Buffer.from(bytes));
      indexBlockHash = decodedBlock.header.index_block_hash;
    }
    // Replay block
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

function unwrapClarityType(clarityValue: codec.ClarityValue): codec.ClarityValue {
  let unwrappedClarityValue: codec.ClarityValue = clarityValue;
  while (
    unwrappedClarityValue.type_id === codec.ClarityTypeID.ResponseOk ||
    unwrappedClarityValue.type_id === codec.ClarityTypeID.OptionalSome
  ) {
    unwrappedClarityValue = unwrappedClarityValue.value;
  }
  return unwrappedClarityValue;
}

function checkAndParseUintCV(result: string): codec.ClarityValueUInt {
  const responseCV = codec.decodeClarityValue(result);
  const unwrappedClarityValue = unwrapClarityType(responseCV);
  if (unwrappedClarityValue.type_id === codec.ClarityTypeID.UInt) {
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
    unwrappedClarityValue.type_id === codec.ClarityTypeID.StringAscii ||
    unwrappedClarityValue.type_id === codec.ClarityTypeID.StringUtf8
  ) {
    return unwrappedClarityValue.data;
  }
  throw new StacksRpcSmartContractError(
    `Unexpected Clarity type '${unwrappedClarityValue.type_id}' while unwrapping string`
  );
}
