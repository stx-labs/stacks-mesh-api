import { request } from 'undici';
import type {
  StacksNodeInfo,
  StacksPoxInfo,
  StacksAccountInfo,
  StacksNeighbors,
  StacksFeeEstimate,
  StacksTransferFee,
  StacksHealthStatus,
  StacksTenureInfo,
  StacksBroadcastResponse,
  StacksMempoolQueryResponse,
  StacksConfirmedTransaction,
  StacksBlockReplay,
  StacksContractCallReadOnlyResult,
  StacksContractInterface,
  StacksContractSource,
  StacksContractConstantVal,
  StacksContractDataVar,
  StacksContractMapEntry,
} from './types.js';
import { logger, timeout } from '@stacks/api-toolkit';
import { StacksRpcBlockNotFoundError, StacksRpcError } from './errors.js';

/**
 * Configuration for the Stacks RPC client.
 */
export interface StacksRpcConfig {
  hostname: string;
  port: number;
  authToken: string;
  timeout?: number;
}

/**
 * A client for the Stacks RPC API.
 */
export class StacksRpcClient {
  private readonly config: StacksRpcConfig;
  private readonly logger = logger.child({ module: 'StacksRpcClient' });
  private readonly baseUrl: string;

  constructor(config: StacksRpcConfig) {
    this.config = config;
    this.baseUrl = `http://${this.config.hostname}:${this.config.port}`;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown | null = null,
    authenticated: boolean = false
  ): Promise<T> {
    return this.requestRaw<T>(
      method,
      path,
      body ? JSON.stringify(body) : undefined,
      authenticated,
      { 'content-type': 'application/json' },
      'json'
    );
  }

  private async requestRaw<T>(
    method: 'GET' | 'POST',
    path: string,
    body: string | Uint8Array | null = null,
    authenticated: boolean = false,
    headers?: Record<string, string>,
    responseType: 'json' | 'buffer' = 'buffer'
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestHeaders = {
      ...(authenticated ? { authorization: this.config.authToken } : {}),
      ...(headers || {}),
    };
    const { statusCode, body: responseBody } = await request(url, {
      method,
      headers: requestHeaders,
      body,
      bodyTimeout: this.config.timeout,
      headersTimeout: this.config.timeout,
    });

    if (statusCode < 200 || statusCode >= 300) {
      const errorText = await responseBody.text();
      throw new StacksRpcError(`RPC request failed: ${statusCode} - ${errorText}`, statusCode, errorText);
    }

    if (responseType === 'json') {
      return (await responseBody.json()) as T;
    } else {
      return Buffer.from(await responseBody.arrayBuffer()) as T;
    }
  }

  // === Node Information ===

  async getInfo(): Promise<StacksNodeInfo> {
    return this.request<StacksNodeInfo>('GET', '/v2/info');
  }

  async waitForNodeReady(): Promise<StacksNodeInfo> {
    this.logger.info(`Connecting to Stacks node at ${this.config.hostname}:${this.config.port}...`);
    while (true) {
      try {
        const nodeInfo = await this.getInfo();
        this.logger.info(
          { server_version: nodeInfo.server_version, network_id: nodeInfo.network_id },
          `Connected to Stacks node`
        );
        return nodeInfo;
      } catch (error) {
        this.logger.warn(error, `Stacks node not ready, trying again in 1s...`);
        await timeout(1000);
      }
    }
  }

  async getPoxInfo(): Promise<StacksPoxInfo> {
    return this.request<StacksPoxInfo>('GET', '/v2/pox');
  }

  async getHealth(): Promise<StacksHealthStatus> {
    return this.request<StacksHealthStatus>('GET', '/v3/health');
  }

  async getNeighbors(): Promise<StacksNeighbors> {
    return this.request<StacksNeighbors>('GET', '/v2/neighbors');
  }

  // === Accounts ===

  async getAccount(
    principal: string,
    options?: { proof?: boolean; tip?: string }
  ): Promise<StacksAccountInfo> {
    const params = new URLSearchParams();
    if (options?.proof !== undefined) {
      params.set('proof', String(options.proof ? 1 : 0));
    }
    if (options?.tip) {
      params.set('tip', options.tip);
    }
    const query = params.toString();
    const path = `/v2/accounts/${principal}${query ? `?${query}` : ''}`;
    return this.request<StacksAccountInfo>('GET', path);
  }

  // === Blocks ===

  async getNakamotoBlockByHash(blockHash: string): Promise<Buffer> {
    try {
      return this.requestRaw('GET', `/v3/blocks/${blockHash}`, undefined, undefined);
    } catch (error) {
      if (error instanceof StacksRpcError && error.statusCode === 404) {
        throw new StacksRpcBlockNotFoundError(blockHash);
      }
      throw error;
    }
  }

  async getNakamotoBlockByHeight(height: number): Promise<Buffer> {
    try {
      return this.requestRaw('GET', `/v3/blocks/height/${height}`, undefined, undefined);
    } catch (error) {
      if (error instanceof StacksRpcError && error.statusCode === 404) {
        throw new StacksRpcBlockNotFoundError(height.toString());
      }
      throw error;
    }
  }

  async replayNakamotoBlock(blockHash: string): Promise<StacksBlockReplay> {
    try {
      return this.request<StacksBlockReplay>('GET', `/v3/blocks/replay/${blockHash}`, null, true);
    } catch (error) {
      if (error instanceof StacksRpcError && error.statusCode === 404) {
        throw new StacksRpcBlockNotFoundError(blockHash);
      }
      throw error;
    }
  }

  // === Tenures ===

  async getTenureInfo(): Promise<StacksTenureInfo> {
    return this.request<StacksTenureInfo>('GET', '/v3/tenures/info');
  }

  async getTenureBlocks(blockId: string): Promise<Buffer> {
    return this.requestRaw('GET', `/v3/tenures/${blockId}`, undefined, undefined);
  }

  // === Transactions ===

  async broadcastTransaction(txHex: string): Promise<StacksBroadcastResponse> {
    const txBytes = hexToBytes(txHex);
    const url = `${this.baseUrl}/v2/transactions`;
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
    };

    const { statusCode, body: responseBody } = await request(url, {
      method: 'POST',
      headers,
      body: txBytes,
      bodyTimeout: this.config.timeout,
      headersTimeout: this.config.timeout,
    });

    if (statusCode < 200 || statusCode >= 300) {
      const errorBody = await responseBody.json().catch(() => ({}));
      return {
        txid: '',
        error: 'broadcast_failed',
        reason: `HTTP ${statusCode}`,
        reason_data: errorBody as Record<string, unknown>,
      };
    }

    const txid = await responseBody.text();
    return { txid: txid.replace(/"/g, '') };
  }

  async getUnconfirmedTransaction(txid: string): Promise<Buffer> {
    return this.requestRaw('GET', `/v2/transactions/unconfirmed/${txid}`);
  }

  async getConfirmedTransaction(txid: string): Promise<StacksConfirmedTransaction> {
    return this.request<StacksConfirmedTransaction>('GET', `/v3/transaction/${txid}`);
  }

  async queryMempool(
    txids: string[],
    pageSize?: number,
    page?: number
  ): Promise<StacksMempoolQueryResponse> {
    return this.request<StacksMempoolQueryResponse>('POST', '/v2/mempool/query', {
      txids,
      page_size: pageSize,
      page,
    });
  }

  // === Fees ===

  async estimateFee(transactionPayload: string): Promise<StacksFeeEstimate> {
    return this.request<StacksFeeEstimate>('POST', '/v2/fees/transaction', {
      transaction_payload: transactionPayload,
    });
  }

  async getTransferFee(): Promise<StacksTransferFee> {
    return this.request<StacksTransferFee>('GET', '/v2/fees/transfer');
  }

  // === Smart Contracts ===

  async getContractInterface(
    contractAddress: string,
    contractName: string
  ): Promise<StacksContractInterface> {
    return this.request<StacksContractInterface>(
      'GET',
      `/v2/contracts/interface/${contractAddress}/${contractName}`
    );
  }

  async getContractSource(
    contractAddress: string,
    contractName: string
  ): Promise<StacksContractSource> {
    return this.request<StacksContractSource>(
      'GET',
      `/v2/contracts/source/${contractAddress}/${contractName}`
    );
  }

  async getContractConstantVal(
    contractAddress: string,
    contractName: string,
    constantName: string
  ): Promise<StacksContractConstantVal> {
    return this.request<StacksContractConstantVal>(
      'GET',
      `/v2/constant_val/${contractAddress}/${contractName}/${constantName}`
    );
  }

  async callReadOnlyFunction(
    contractAddress: string,
    contractName: string,
    functionName: string,
    args: string[],
    sender: string,
    sponsor?: string
  ): Promise<StacksContractCallReadOnlyResult> {
    const body: Record<string, unknown> = { sender, arguments: args };
    if (sponsor) {
      body.sponsor = sponsor;
    }
    return this.request<StacksContractCallReadOnlyResult>(
      'POST',
      `/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
      body
    );
  }

  async getMapEntry(
    contractAddress: string,
    contractName: string,
    mapName: string,
    key: string
  ): Promise<StacksContractMapEntry> {
    return this.request<StacksContractMapEntry>(
      'POST',
      `/v2/map_entry/${contractAddress}/${contractName}/${mapName}`,
      key
    );
  }

  async getContractDataVar(
    principal: string,
    contractName: string,
    varName: string
  ): Promise<StacksContractDataVar> {
    return this.request<StacksContractDataVar>(
      'GET',
      `/v2/data_var/${principal}/${contractName}/${varName}`
    );
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
