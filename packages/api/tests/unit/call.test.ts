import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { buildApiServer } from '../../src/api/index.js';
import { StacksRpcClient } from '../../src/stacks-rpc/stacks-rpc-client.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

const DEPLOYER = 'SP3SBQ9PZEMBNBAWTR7FRPE3XK0EFW9JWVX4G80S2';
const CONTRACT = 'my-contract';
const SENDER = 'SP3XXK8BG5X7CRH7W07RRJK3JZJXJ799WX3Y0SMCR';

function postCall(fastify: FastifyInstance, method: string, parameters: object) {
  return fastify.inject({
    url: '/call',
    method: 'POST',
    payload: JSON.stringify({
      network_identifier: { blockchain: 'stacks', network: 'testnet' },
      method,
      parameters,
    }),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/call', () => {
  let fastify: FastifyInstance;
  let rpcClient: StacksRpcClient;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    rpcClient = new StacksRpcClient({
      hostname: 'test.stacks.node',
      port: 20444,
      authToken: 'test-token',
    });
    fastify = await buildApiServer({
      rpcClient,
      network: 'testnet',
      nodeVersion: '1.0.0',
    });
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  describe('contract_call_read_only', () => {
    test('should return successful read-only call result', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/contracts/call-read/${DEPLOYER}/${CONTRACT}/get-balance`,
          method: 'POST',
        })
        .reply(200, { okay: true, result: '0x0100000000000000000000000000000064' }, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_call_read_only', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
        function_name: 'get-balance',
        sender: SENDER,
        arguments: ['0x0516a26392d8d7f66f70a6981f4c1e0d87dc4fb0b1a7'],
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, false);
      assert.deepStrictEqual(json.result, {
        okay: true,
        result: '0x0100000000000000000000000000000064',
      });
    });

    test('should return error result when call fails', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/contracts/call-read/${DEPLOYER}/${CONTRACT}/transfer`,
          method: 'POST',
        })
        .reply(200, { okay: false, cause: 'Unchecked(NoSuchPublicFunction)' }, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_call_read_only', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
        function_name: 'transfer',
        sender: SENDER,
        arguments: [],
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, false);
      assert.deepStrictEqual(json.result, {
        okay: false,
        cause: 'Unchecked(NoSuchPublicFunction)',
      });
    });
  });

  describe('contract_get_interface', () => {
    test('should return contract interface', async () => {
      const mockInterface = {
        functions: [
          { name: 'transfer', access: 'public', args: [], outputs: { type: 'bool' } },
          { name: 'get-balance', access: 'read_only', args: [], outputs: { type: 'uint128' } },
        ],
        variables: [],
        maps: [],
        fungible_tokens: [{ name: 'my-token' }],
        non_fungible_tokens: [],
      };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/contracts/interface/${DEPLOYER}/${CONTRACT}`,
          method: 'GET',
        })
        .reply(200, mockInterface, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_get_interface', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, true);
      assert.deepStrictEqual(json.result, mockInterface);
    });
  });

  describe('contract_get_source', () => {
    test('should return contract source code', async () => {
      const mockSource = {
        source: '(define-public (transfer (amount uint)) (ok true))',
        publish_height: 100000,
      };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/contracts/source/${DEPLOYER}/${CONTRACT}`,
          method: 'GET',
        })
        .reply(200, mockSource, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_get_source', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, true);
      assert.strictEqual(json.result.source, mockSource.source);
      assert.strictEqual(json.result.publish_height, 100000);
    });
  });

  describe('contract_get_constant_val', () => {
    test('should return contract constant value', async () => {
      const mockConstant = { data: '0x0100000000000000000000000000989680' };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/constant_val/${DEPLOYER}/${CONTRACT}/MAX_SUPPLY`,
          method: 'GET',
        })
        .reply(200, mockConstant, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_get_constant_val', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
        constant_name: 'MAX_SUPPLY',
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, true);
      assert.deepStrictEqual(json.result, {
        okay: true,
        result: mockConstant,
      });
    });
  });

  describe('contract_get_data_var', () => {
    test('should return contract data variable', async () => {
      const mockVar = { data: '0x0100000000000000000000000000000001' };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/data_var/${DEPLOYER}/${CONTRACT}/total-supply`,
          method: 'GET',
        })
        .reply(200, mockVar, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_get_data_var', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
        var_name: 'total-supply',
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, false);
      assert.deepStrictEqual(json.result, {
        okay: true,
        result: mockVar,
      });
    });
  });

  describe('contract_get_map_entry', () => {
    test('should return contract map entry', async () => {
      const mockEntry = { data: '0x0a0c00000002046e616d650200000003666f6f' };

      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockPool
        .intercept({
          path: `/v2/map_entry/${DEPLOYER}/${CONTRACT}/balances`,
          method: 'POST',
        })
        .reply(200, mockEntry, {
          headers: { 'content-type': 'application/json' },
        });

      const response = await postCall(fastify, 'contract_get_map_entry', {
        deployer_address: DEPLOYER,
        contract_name: CONTRACT,
        map_name: 'balances',
        key: '0x0516a26392d8d7f66f70a6981f4c1e0d87dc4fb0b1a7',
      });

      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      assert.strictEqual(json.idempotent, false);
      assert.deepStrictEqual(json.result, {
        okay: true,
        result: mockEntry,
      });
    });
  });

  describe('unsupported method', () => {
    test('should reject unknown method via schema validation', async () => {
      const response = await postCall(fastify, 'unknown_method' as string, {});

      // Fastify rejects the request at schema validation before reaching the handler
      assert.strictEqual(response.statusCode, 500);
    });
  });
});
