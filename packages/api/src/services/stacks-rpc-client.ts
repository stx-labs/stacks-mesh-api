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
} from './types.js';

export interface StacksRpcConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class StacksRpcClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: StacksRpcConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.apiKey) {
      headers['authorization'] = this.apiKey;
    }

    const { statusCode, body: responseBody } = await request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
    });

    if (statusCode < 200 || statusCode >= 300) {
      const errorText = await responseBody.text();
      throw new StacksRpcError(
        `RPC request failed: ${statusCode}`,
        statusCode,
        errorText
      );
    }

    return await responseBody.json() as T;
  }

  private async requestRaw(
    method: 'GET' | 'POST',
    path: string,
    body?: Uint8Array,
    contentType?: string
  ): Promise<Buffer> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (contentType) {
      headers['content-type'] = contentType;
    }

    if (this.apiKey) {
      headers['authorization'] = this.apiKey;
    }

    const { statusCode, body: responseBody } = await request(url, {
      method,
      headers,
      body,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
    });

    if (statusCode < 200 || statusCode >= 300) {
      const errorText = await responseBody.text();
      throw new StacksRpcError(
        `RPC request failed: ${statusCode}`,
        statusCode,
        errorText
      );
    }

    return Buffer.from(await responseBody.arrayBuffer());
  }

  // === Node Information ===

  async getInfo(): Promise<StacksNodeInfo> {
    return this.request<StacksNodeInfo>('GET', '/v2/info');
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

  async getBlockByHash(blockHash: string): Promise<Buffer> {
    return this.requestRaw('GET', `/v3/blocks/${blockHash}`);
  }

  async getBlockByHeight(height: number): Promise<Buffer> {
    return this.requestRaw('GET', `/v3/blocks/height/${height}`);
  }

  async getLegacyBlock(blockId: string): Promise<Buffer> {
    return this.requestRaw('GET', `/v2/blocks/${blockId}`);
  }

  // === Tenures ===

  async getTenureInfo(): Promise<StacksTenureInfo> {
    return this.request<StacksTenureInfo>('GET', '/v3/tenures/info');
  }

  async getTenureBlocks(blockId: string): Promise<Buffer> {
    return this.requestRaw('GET', `/v3/tenures/${blockId}`);
  }

  // === Transactions ===

  async broadcastTransaction(txHex: string): Promise<StacksBroadcastResponse> {
    const txBytes = hexToBytes(txHex);
    const url = `${this.baseUrl}/v2/transactions`;
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
    };

    if (this.apiKey) {
      headers['authorization'] = this.apiKey;
    }

    const { statusCode, body: responseBody } = await request(url, {
      method: 'POST',
      headers,
      body: txBytes,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
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

  async getUnconfirmedTransaction(txid: string): Promise<unknown> {
    return this.request<unknown>('GET', `/v2/transactions/unconfirmed/${txid}`);
  }

  async getConfirmedTransaction(txid: string): Promise<unknown> {
    return this.request<unknown>('GET', `/v3/transaction/${txid}`);
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
    contractName: string,
    tip?: string
  ): Promise<unknown> {
    const params = tip ? `?tip=${tip}` : '';
    return this.request<unknown>(
      'GET',
      `/v2/contracts/interface/${contractAddress}/${contractName}${params}`
    );
  }

  async getContractSource(
    contractAddress: string,
    contractName: string,
    options?: { proof?: boolean; tip?: string }
  ): Promise<{ source: string; publish_height: number; proof?: string }> {
    const params = new URLSearchParams();
    if (options?.proof !== undefined) {
      params.set('proof', String(options.proof ? 1 : 0));
    }
    if (options?.tip) {
      params.set('tip', options.tip);
    }
    const query = params.toString();
    return this.request<{ source: string; publish_height: number; proof?: string }>(
      'GET',
      `/v2/contracts/source/${contractAddress}/${contractName}${query ? `?${query}` : ''}`
    );
  }

  async callReadOnlyFunction(
    contractAddress: string,
    contractName: string,
    functionName: string,
    args: string[],
    sender: string,
    tip?: string
  ): Promise<{ okay: boolean; result?: string; cause?: string }> {
    const params = tip ? `?tip=${tip}` : '';
    return this.request<{ okay: boolean; result?: string; cause?: string }>(
      'POST',
      `/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}${params}`,
      { sender, arguments: args }
    );
  }

  async getMapEntry(
    contractAddress: string,
    contractName: string,
    mapName: string,
    key: string,
    options?: { proof?: boolean; tip?: string }
  ): Promise<{ data?: string; proof?: string }> {
    const params = new URLSearchParams();
    if (options?.proof !== undefined) {
      params.set('proof', String(options.proof ? 1 : 0));
    }
    if (options?.tip) {
      params.set('tip', options.tip);
    }
    const query = params.toString();
    return this.request<{ data?: string; proof?: string }>(
      'POST',
      `/v2/map_entry/${contractAddress}/${contractName}/${mapName}${query ? `?${query}` : ''}`,
      key
    );
  }

  async getDataVar(
    principal: string,
    contractName: string,
    varName: string,
    options?: { proof?: boolean; tip?: string }
  ): Promise<{ data?: string; proof?: string }> {
    const params = new URLSearchParams();
    if (options?.proof !== undefined) {
      params.set('proof', String(options.proof ? 1 : 0));
    }
    if (options?.tip) {
      params.set('tip', options.tip);
    }
    const query = params.toString();
    return this.request<{ data?: string; proof?: string }>(
      'GET',
      `/v2/data_var/${principal}/${contractName}/${varName}${query ? `?${query}` : ''}`
    );
  }
}

export class StacksRpcError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'StacksRpcError';
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
