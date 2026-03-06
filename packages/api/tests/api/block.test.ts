import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, before, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import { ApiConfig, buildApiServer } from '../../src/api/index.js';
import { loadBinaryFixture, loadFixture, makeTestApiConfig } from './helpers.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

function mockReplay(mockPool: ReturnType<MockAgent['get']>, blockId: string, fixture: object) {
  mockPool
    .intercept({ path: `/v3/blocks/replay/${blockId}`, method: 'GET' })
    .reply(200, fixture, { headers: { 'content-type': 'application/json' } });
}

function postBlock(fastify: FastifyInstance, hash: string) {
  return fastify.inject({
    url: '/block',
    method: 'POST',
    payload: JSON.stringify({
      network_identifier: { blockchain: 'stacks', network: 'mainnet' },
      block_identifier: { hash: `0x${hash}` },
    }),
    headers: { 'content-type': 'application/json' },
  });
}

function postBlockTransaction(fastify: FastifyInstance, blockHash: string, txHash: string) {
  return fastify.inject({
    url: '/block/transaction',
    method: 'POST',
    payload: JSON.stringify({
      network_identifier: { blockchain: 'stacks', network: 'mainnet' },
      block_identifier: { hash: `0x${blockHash}` },
      transaction_identifier: { hash: `0x${txHash}` },
    }),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/block', () => {
  let fastify: FastifyInstance;
  let mockAgent: MockAgent;
  let config: ApiConfig;

  before(() => {
    config = makeTestApiConfig();
    config.contractAbiCache['cache'].set(
      'SP21EK0KSQG7HEHBGCVRJGPGFMV8SCA2B85X01DK2.blocksurvey-proof-of-submission',
      loadFixture('contract-interfaces/blocksurvey-proof-of-submission.json')
    );
    config.contractAbiCache['cache'].set(
      'SP06ARSREC0N9AKZABRP23SXS62TWJ6KWPVDQHVX.cn',
      loadFixture('contract-interfaces/cn.json')
    );
    config.contractAbiCache['cache'].set(
      'SP2H674PRTZV6YW56K0FMR7GDGZE4ZC5HMYZ3CDEV.hemp',
      loadFixture('contract-interfaces/hemp.json')
    );
    config.contractAbiCache['cache'].set(
      'SP1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXRCD0S3K.message-board',
      loadFixture('contract-interfaces/message-board.json')
    );
    config.contractAbiCache['cache'].set(
      'SPFJRRM1NTW9V3AQ324NMWHSNAZQ6YM1D5XK1BHA.message-board',
      loadFixture('contract-interfaces/message-board.json')
    );
    config.contractAbiCache['cache'].set(
      'SPHMTFCMSSB0K32EZGN90XB16FCB4YE56CTZ16FR.message-board',
      loadFixture('contract-interfaces/message-board.json')
    );
    config.contractAbiCache['cache'].set(
      'SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF.BNS-V2',
      loadFixture('contract-interfaces/BNS-V2.json')
    );
    config.contractAbiCache['cache'].set(
      'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v6',
      loadFixture('contract-interfaces/stacking-dao-core-v6.json')
    );
    config.contractAbiCache['cache'].set(
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-swap-helper-v-1-3',
      loadFixture('contract-interfaces/xyk-swap-helper-v-1-3.json')
    );
    config.tokenMetadataCache['cache'].set(
      'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token::ststx',
      {
        symbol: 'stSTX',
        decimals: 6,
        name: 'stSTX',
      }
    );
    config.tokenMetadataCache['cache'].set(
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token',
      {
        symbol: 'sBTC',
        decimals: 8,
        name: 'sBTC',
      }
    );
    config.tokenMetadataCache['cache'].set(
      'SP21EK0KSQG7HEHBGCVRJGPGFMV8SCA2B85X01DK2.blocksurvey-token::blocksurvey',
      {
        symbol: 'BLOCKSURVEY',
        decimals: 6,
        name: 'Blocksurvey',
      }
    );
    config.tokenMetadataCache['cache'].set(
      'SP27BB1Y2DGSXZHS7G9YHKTSH6KQ6BD3QG0AN3CR9.vibes-token::vibes-token',
      {
        symbol: 'VIBES',
        decimals: 6,
        name: 'Vibes',
      }
    );
    config.tokenMetadataCache['cache'].set(
      'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex::alex',
      {
        symbol: 'TOKEN-ALEX',
        decimals: 6,
        name: 'Token Alex',
      }
    );
  });

  beforeEach(async () => {
    fastify = await buildApiServer(config);
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    mockAgent.close();
  });

  describe('coinbase + tenure change block', () => {
    const fixture = loadFixture('blocks/coinbase.json');

    test('should fetch block header if only block height is given', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      // Mock block header fetch
      const blockHeaderFixture = loadBinaryFixture('blocks/coinbase.header.bin');
      mockPool
        .intercept({ path: `/v3/blocks/height/5437107`, method: 'GET' })
        .reply(200, blockHeaderFixture, {
          headers: { 'content-type': 'application/octet-stream' },
        });

      const response = await fastify.inject({
        url: '/block',
        method: 'POST',
        payload: JSON.stringify({
          network_identifier: { blockchain: 'stacks', network: 'mainnet' },
          block_identifier: { index: 5437107 },
        }),
        headers: { 'content-type': 'application/json' },
      });
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      assert.deepStrictEqual(block.block_identifier, {
        index: 5437107,
        hash: `0x${fixture.block_id}`,
      });
    });

    test('should return block with tenure_change and coinbase transactions', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // Block identifiers
      assert.deepStrictEqual(block.block_identifier, {
        index: 5437107,
        hash: `0x${fixture.block_id}`,
      });
      assert.deepStrictEqual(block.parent_block_identifier, {
        index: 5437106,
        hash: `0x${fixture.parent_block_id}`,
      });
      assert.strictEqual(block.timestamp, fixture.timestamp * 1000);

      // 2 transactions: tenure change + coinbase
      assert.strictEqual(block.transactions.length, 2);

      // Tenure change transaction
      const tenureTx = block.transactions[0];
      assert.strictEqual(tenureTx.transaction_identifier.hash, `0x${fixture.transactions[0].txid}`);
      assert.strictEqual(tenureTx.metadata.type, 'tenure_change');
      assert.strictEqual(tenureTx.metadata.status, 'success');
      assert.strictEqual(tenureTx.metadata.sponsored, false);
      assert.strictEqual(tenureTx.metadata.canonical, true);
      assert.strictEqual(tenureTx.metadata.fee_rate, '0');
      assert.strictEqual(tenureTx.metadata.position.index, 0);
      assert.strictEqual(tenureTx.metadata.vm_error, null);

      // Tenure change has 1 operation (no fee since fee=0)
      assert.strictEqual(tenureTx.operations.length, 1);
      const tenureOp = tenureTx.operations[0];
      assert.strictEqual(tenureOp.operation_identifier.index, 0);
      assert.strictEqual(tenureOp.type, 'tenure_change');
      assert.strictEqual(tenureOp.status, 'success');
      assert.strictEqual(
        tenureOp.metadata.tenure_consensus_hash,
        '0x51e178ffdea53e02bbef13cdd2cec889728f8686'
      );
      assert.strictEqual(
        tenureOp.metadata.prev_tenure_consensus_hash,
        '0x1d136e7a89eb84466e8bbf7e8ea6d8fc583ec9f5'
      );
      assert.strictEqual(tenureOp.metadata.cause, 'block_found');
      assert.strictEqual(tenureOp.metadata.previous_tenure_blocks, 356);

      // Coinbase transaction
      const coinbaseTx = block.transactions[1];
      assert.strictEqual(
        coinbaseTx.transaction_identifier.hash,
        `0x${fixture.transactions[1].txid}`
      );
      assert.strictEqual(coinbaseTx.metadata.type, 'coinbase');
      assert.strictEqual(coinbaseTx.metadata.status, 'success');
      assert.strictEqual(coinbaseTx.metadata.fee_rate, '0');
      assert.strictEqual(coinbaseTx.metadata.position.index, 1);

      // Coinbase has 1 operation (no fee since fee=0)
      assert.strictEqual(coinbaseTx.operations.length, 1);
      const coinbaseOp = coinbaseTx.operations[0];
      assert.strictEqual(coinbaseOp.operation_identifier.index, 0);
      assert.strictEqual(coinbaseOp.type, 'coinbase');
      assert.strictEqual(coinbaseOp.status, 'success');
      assert.strictEqual(coinbaseOp.metadata.alt_recipient, null);
      assert.ok(coinbaseOp.metadata.vrf_proof);
    });
  });

  describe('token transfer block', () => {
    const fixture = loadFixture('blocks/token-transfer.json');

    test('should return block with STX transfer and correct operations', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // Block identifiers
      assert.deepStrictEqual(block.block_identifier, {
        index: 5437488,
        hash: `0x${fixture.block_id}`,
      });
      assert.strictEqual(block.timestamp, fixture.timestamp * 1000);
      assert.strictEqual(block.transactions.length, 1);

      const tx = block.transactions[0];
      assert.strictEqual(tx.transaction_identifier.hash, `0x${fixture.transactions[0].txid}`);
      assert.strictEqual(tx.metadata.type, 'token_transfer');
      assert.strictEqual(tx.metadata.status, 'success');
      assert.strictEqual(tx.metadata.fee_rate, '180');
      assert.strictEqual(tx.metadata.result.hex, '0x0703');
      assert.strictEqual(tx.metadata.result.repr, '(ok true)');
      assert.ok(tx.metadata.raw_tx.startsWith('0x'));

      // Operations: fee + send + receive = 3
      assert.strictEqual(tx.operations.length, 3);

      // Fee operation
      const feeOp = tx.operations[0];
      assert.strictEqual(feeOp.operation_identifier.index, 0);
      assert.strictEqual(feeOp.type, 'fee');
      assert.strictEqual(feeOp.status, 'success');
      assert.strictEqual(feeOp.amount.value, '-180');
      assert.deepStrictEqual(feeOp.amount.currency, { symbol: 'STX', decimals: 6 });

      // STX transfer send
      const sendOp = tx.operations[1];
      assert.strictEqual(sendOp.operation_identifier.index, 1);
      assert.strictEqual(sendOp.type, 'token_transfer');
      assert.strictEqual(sendOp.account.address, 'SP3XXK8BG5X7CRH7W07RRJK3JZJXJ799WX3Y0SMCR');
      assert.strictEqual(sendOp.amount.value, '-1');
      assert.deepStrictEqual(sendOp.amount.currency, { symbol: 'STX', decimals: 6 });

      // STX transfer receive
      const receiveOp = tx.operations[2];
      assert.strictEqual(receiveOp.operation_identifier.index, 2);
      assert.strictEqual(receiveOp.type, 'token_transfer');
      assert.strictEqual(receiveOp.account.address, 'SP3SBQ9PZEMBNBAWTR7FRPE3XK0EFW9JWVX4G80S2');
      assert.strictEqual(receiveOp.amount.value, '1');
      assert.deepStrictEqual(receiveOp.amount.currency, { symbol: 'STX', decimals: 6 });
    });
  });

  describe('contract call block with events', () => {
    const fixture = loadFixture('blocks/contract-call.json');

    test('should return block with multiple transactions and event-derived operations', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200, response.body);
      const json = JSON.parse(response.body);
      const block = json.block;

      assert.strictEqual(block.block_identifier.index, 5037488);
      assert.strictEqual(block.transactions.length, 4);

      // First tx: token transfer with stx_transfer_event
      const tx0 = block.transactions[0];
      assert.strictEqual(tx0.metadata.type, 'token_transfer');
      assert.strictEqual(tx0.operations[0].type, 'fee');
      // Fee + send + receive = 3 operations
      assert.strictEqual(tx0.operations.length, 3);

      // Second tx: contract call with ft_mint_event
      const tx1 = block.transactions[1];
      assert.strictEqual(tx1.metadata.type, 'contract_call');
      // Should have: fee + contract_call + ft_mint = 3 operations
      assert.strictEqual(tx1.operations.length, 3);

      const contractCallOp = tx1.operations[1];
      assert.strictEqual(contractCallOp.type, 'contract_call');
      assert.strictEqual(contractCallOp.status, 'success');
      assert.ok(
        contractCallOp.metadata.contract_identifier.includes('blocksurvey-proof-of-submission')
      );
      assert.strictEqual(contractCallOp.metadata.function_name, 'proof-of-submission');

      // Contract call args serialized from ABI
      assert.strictEqual(contractCallOp.metadata.args.length, 4);
      assert.strictEqual(contractCallOp.metadata.args[0].name, 'survey-id');
      assert.strictEqual(contractCallOp.metadata.args[0].type, '(string-utf8 256)');
      assert.strictEqual(contractCallOp.metadata.args[1].name, 'response-id');
      assert.strictEqual(contractCallOp.metadata.args[1].type, '(string-utf8 256)');
      assert.strictEqual(contractCallOp.metadata.args[2].name, 'response-hash');
      assert.strictEqual(contractCallOp.metadata.args[2].type, '(string-utf8 256)');
      assert.strictEqual(contractCallOp.metadata.args[3].name, 'gas-fee');
      assert.strictEqual(contractCallOp.metadata.args[3].type, 'uint');
      assert.strictEqual(contractCallOp.metadata.args[3].repr, 'u417');
      // All args should have hex values
      for (const arg of contractCallOp.metadata.args) {
        assert.ok(arg.hex.startsWith('0x'), `Arg ${arg.name} hex should start with 0x`);
        assert.ok(arg.repr, `Arg ${arg.name} should have repr`);
      }

      const ftMintOp = tx1.operations[2];
      assert.strictEqual(ftMintOp.type, 'token_mint');
      assert.strictEqual(ftMintOp.amount.value, '417');
      assert.strictEqual(
        ftMintOp.amount.currency.metadata.asset_identifier,
        'SP21EK0KSQG7HEHBGCVRJGPGFMV8SCA2B85X01DK2.blocksurvey-token::blocksurvey'
      );
      assert.strictEqual(ftMintOp.amount.currency.metadata.token_type, 'ft');
      // Token metadata from cache
      assert.strictEqual(ftMintOp.amount.currency.symbol, 'BLOCKSURVEY');
      assert.strictEqual(ftMintOp.amount.currency.decimals, 6);
      assert.strictEqual(ftMintOp.amount.currency.metadata.name, 'Blocksurvey');

      // Third tx: contract call with no events (committed: false)
      const tx2 = block.transactions[2];
      assert.strictEqual(tx2.metadata.type, 'contract_call');
      // fee + contract_call = 2 operations (no events)
      assert.strictEqual(tx2.operations.length, 2);

      // Contract call args from cn ABI
      const tx2ContractCallOp = tx2.operations[1];
      assert.strictEqual(tx2ContractCallOp.metadata.function_name, 'r1');
      assert.strictEqual(tx2ContractCallOp.metadata.args.length, 1);
      assert.strictEqual(tx2ContractCallOp.metadata.args[0].name, 'bu');
      assert.strictEqual(tx2ContractCallOp.metadata.args[0].type, '(buff 7)');
      assert.ok(tx2ContractCallOp.metadata.args[0].hex.startsWith('0x'));

      // Fourth tx: contract call with stx_transfer, contract_event, ft_transfer events
      const tx3 = block.transactions[3];
      assert.strictEqual(tx3.metadata.type, 'contract_call');

      // Verify contract_call operation
      assert.strictEqual(tx3.operations[1].type, 'contract_call');

      // Contract call args from hemp ABI
      const tx3ContractCallOp = tx3.operations[1];
      assert.strictEqual(tx3ContractCallOp.metadata.function_name, 'ri');
      assert.strictEqual(tx3ContractCallOp.metadata.args.length, 2);
      assert.strictEqual(tx3ContractCallOp.metadata.args[0].name, 'b');
      assert.strictEqual(tx3ContractCallOp.metadata.args[1].name, 't');

      // Verify STX transfer operations from events
      const stxSendOp = tx3.operations[2];
      assert.strictEqual(stxSendOp.type, 'token_transfer');
      assert.strictEqual(stxSendOp.amount.value, '-928252');
      assert.deepStrictEqual(stxSendOp.amount.currency, { symbol: 'STX', decimals: 6 });

      const stxReceiveOp = tx3.operations[3];
      assert.strictEqual(stxReceiveOp.type, 'token_transfer');
      assert.strictEqual(stxReceiveOp.amount.value, '928252');

      // Verify contract_log operation from contract_event
      const contractLogOp = tx3.operations[4];
      assert.strictEqual(contractLogOp.type, 'contract_log');
      assert.strictEqual(
        contractLogOp.metadata.contract_identifier,
        'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.stackswap-swap-v5k'
      );
      assert.strictEqual(contractLogOp.metadata.topic, 'print');

      // Verify FT transfer operations (VIBES)
      const ftSendOp = tx3.operations[7];
      assert.strictEqual(ftSendOp.type, 'token_transfer');
      assert.strictEqual(ftSendOp.amount.value, '-1077761294227');
      assert.strictEqual(ftSendOp.amount.currency.metadata.token_type, 'ft');
      assert.strictEqual(
        ftSendOp.amount.currency.metadata.asset_identifier,
        'SP27BB1Y2DGSXZHS7G9YHKTSH6KQ6BD3QG0AN3CR9.vibes-token::vibes-token'
      );
      // Token metadata from cache for VIBES
      assert.strictEqual(ftSendOp.amount.currency.symbol, 'VIBES');
      assert.strictEqual(ftSendOp.amount.currency.decimals, 6);
      assert.strictEqual(ftSendOp.amount.currency.metadata.name, 'Vibes');

      const ftReceiveOp = tx3.operations[8];
      assert.strictEqual(ftReceiveOp.type, 'token_transfer');
      assert.strictEqual(ftReceiveOp.amount.value, '1077761294227');
      assert.strictEqual(ftReceiveOp.amount.currency.symbol, 'VIBES');

      // Verify FT transfer operations (TOKEN-ALEX)
      const alexSendOp = tx3.operations[11];
      assert.strictEqual(alexSendOp.type, 'token_transfer');
      assert.strictEqual(alexSendOp.amount.value, '-21062536889');
      assert.strictEqual(
        alexSendOp.amount.currency.metadata.asset_identifier,
        'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex::alex'
      );
      // Token metadata from cache for TOKEN-ALEX
      assert.strictEqual(alexSendOp.amount.currency.symbol, 'TOKEN-ALEX');
      assert.strictEqual(alexSendOp.amount.currency.decimals, 6);
      assert.strictEqual(alexSendOp.amount.currency.metadata.name, 'Token Alex');
    });
  });

  describe('contract deploy block', () => {
    const fixture = loadFixture('blocks/contract-deploy.json');

    test('should return block with contract deploy transaction', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      assert.strictEqual(block.block_identifier.index, 5299259);
      assert.strictEqual(block.transactions.length, 2);

      // First tx: contract deploy (SIP009 NFT trait)
      const tx0 = block.transactions[0];
      assert.strictEqual(tx0.metadata.type, 'contract_deploy');
      assert.strictEqual(tx0.metadata.status, 'success');

      // Operations: fee + contract_deploy = 2
      assert.strictEqual(tx0.operations.length, 2);

      const feeOp = tx0.operations[0];
      assert.strictEqual(feeOp.type, 'fee');
      assert.strictEqual(feeOp.amount.value, `-${fixture.fees}`);

      const deployOp = tx0.operations[1];
      assert.strictEqual(deployOp.type, 'contract_deploy');
      assert.strictEqual(deployOp.status, 'success');
      assert.ok(deployOp.metadata.contract_identifier.includes('sip009-nft-trait'));
      assert.ok(deployOp.metadata.source_code.includes('define-trait'));
      assert.ok(deployOp.metadata.clarity_version !== undefined);

      // Second tx: token transfer
      const tx1 = block.transactions[1];
      assert.strictEqual(tx1.metadata.type, 'token_transfer');
      assert.strictEqual(tx1.operations.length, 3); // fee + send + receive
    });
  });

  describe('tenure change extended', () => {
    const fixture = loadFixture('blocks/tenure-change.json');

    test('should return block with tenure change extended cause', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      assert.strictEqual(block.block_identifier.index, 557923);
      assert.strictEqual(block.transactions.length, 1);

      const tx = block.transactions[0];
      assert.strictEqual(tx.metadata.type, 'tenure_change');

      // No fee operation since fees=0
      assert.strictEqual(tx.operations.length, 1);

      const tenureOp = tx.operations[0];
      assert.strictEqual(tenureOp.type, 'tenure_change');
      assert.strictEqual(tenureOp.metadata.cause, 'extended');
      // prev and current consensus hash are the same for Extended
      assert.strictEqual(
        tenureOp.metadata.tenure_consensus_hash,
        '0xe86587f4ed4ca465b87649ace9341d9fdfd113ba'
      );
      assert.strictEqual(
        tenureOp.metadata.prev_tenure_consensus_hash,
        '0xe86587f4ed4ca465b87649ace9341d9fdfd113ba'
      );
      assert.strictEqual(tenureOp.metadata.previous_tenure_blocks, 8);
    });
  });

  describe('NFT transfer event', () => {
    const fixture = loadFixture('blocks/nft-transfer.json');

    test('should serialize NFT transfer as token_transfer operations', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // First tx has NFT transfer + contract_event
      const tx0 = block.transactions[0];
      assert.strictEqual(tx0.metadata.type, 'contract_call');

      // Find NFT transfer operations (first event operations after fee + contract_call)
      const nftSendOp = tx0.operations[2];
      assert.strictEqual(nftSendOp.type, 'token_transfer');
      assert.strictEqual(nftSendOp.amount.value, '-1');
      assert.strictEqual(nftSendOp.amount.currency.metadata.token_type, 'nft');
      assert.strictEqual(nftSendOp.account.address, 'SP24F9982BS7G8DEAG2F2BD34JMV4E27J72QWBYK5');

      const nftReceiveOp = tx0.operations[3];
      assert.strictEqual(nftReceiveOp.type, 'token_transfer');
      assert.strictEqual(nftReceiveOp.amount.value, '1');
      assert.strictEqual(nftReceiveOp.amount.currency.metadata.token_type, 'nft');
      assert.strictEqual(
        nftReceiveOp.account.address,
        'SP1GWN5GFV1KNNGFWBDJA79Q6XMYPZNK51Y6NB8NW.auction-v2'
      );
    });
  });

  describe('STX burn + NFT mint events', () => {
    const fixture = loadFixture('blocks/stx-burn.json');

    test('should serialize STX burn and NFT mint events', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // First tx has nft_mint + stx_burn + contract_event
      const tx0 = block.transactions[0];
      assert.strictEqual(tx0.metadata.type, 'contract_call');

      // fee + contract_call + nft_mint + stx_burn + contract_log = 5
      assert.strictEqual(tx0.operations.length, 5);

      // NFT mint operation
      const nftMintOp = tx0.operations[2];
      assert.strictEqual(nftMintOp.type, 'token_mint');
      assert.strictEqual(nftMintOp.amount.value, '1');
      assert.strictEqual(nftMintOp.amount.currency.metadata.token_type, 'nft');
      assert.strictEqual(nftMintOp.account.address, 'SP042ZTCM11JW92E9F52B50706SA6YAEV9Q0ZVJA');

      // STX burn operation
      const stxBurnOp = tx0.operations[3];
      assert.strictEqual(stxBurnOp.type, 'token_burn');
      assert.strictEqual(stxBurnOp.amount.value, '-2000000');
      assert.deepStrictEqual(stxBurnOp.amount.currency, { symbol: 'STX', decimals: 6 });
      assert.strictEqual(
        stxBurnOp.account.address,
        'SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF.BNS-V2'
      );

      // Contract log operation
      const contractLogOp = tx0.operations[4];
      assert.strictEqual(contractLogOp.type, 'contract_log');
      assert.strictEqual(
        contractLogOp.metadata.contract_identifier,
        'SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF.BNS-V2'
      );
    });
  });

  describe('FT burn event', () => {
    const fixture = loadFixture('blocks/ft-burn.json');

    test('should serialize FT burn events', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // Find the contract call tx that has ft_burn_event (second tx - 7bcad11f...)
      const tx = block.transactions[1];
      assert.strictEqual(tx.metadata.type, 'contract_call');

      // Find the ft_burn operation - look for token_burn with ft metadata
      const ftBurnOps = tx.operations.filter(
        (op: { type: string; amount?: { currency?: { metadata?: { token_type: string } } } }) =>
          op.type === 'token_burn' && op.amount?.currency?.metadata?.token_type === 'ft'
      );
      assert.ok(ftBurnOps.length > 0, 'Expected at least one FT burn operation');

      const ftBurnOp = ftBurnOps[0];
      assert.strictEqual(ftBurnOp.amount.value, '-1313509024');
      assert.strictEqual(
        ftBurnOp.amount.currency.metadata.asset_identifier,
        'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token::ststx'
      );
      assert.strictEqual(ftBurnOp.account.address, 'SPZD2MFC5R2FC0SNZ8SNZ9YCVM0YB4ZA0GRE1364');
    });
  });

  describe('contract event block', () => {
    const fixture = loadFixture('blocks/contract-event.json');

    test('should serialize contract events as contract_log operations', async () => {
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const block = json.block;

      // Second tx has stx_transfer + contract_events + ft_transfer
      const tx = block.transactions[1];
      assert.strictEqual(tx.metadata.type, 'contract_call');

      // Verify all contract_log operations have expected fields
      const contractLogOps = tx.operations.filter(
        (op: { type: string }) => op.type === 'contract_log'
      );
      assert.ok(contractLogOps.length > 0, 'Expected at least one contract_log operation');

      const op = contractLogOps[0];
      assert.equal(
        op.metadata.value.type,
        '(tuple (action (string-ascii 8)) (caller principal) (data (tuple (amount uint) (memo (optional UnknownType)) (recipient principal) (sender principal))))'
      );
      assert.equal(
        op.metadata.value.hex,
        '0x0c0000000306616374696f6e0d000000087472616e736665720663616c6c65720516f4cac43d17b396167e71965a8ad9a97415e6d65e04646174610c0000000406616d6f756e74010000000000000000000000000000000a046d656d6f0909726563697069656e740516e8ca22699ba547d0d4a852196ea5628a1a3727550673656e6465720516f4cac43d17b396167e71965a8ad9a97415e6d65e'
      );
      assert.equal(
        op.metadata.value.repr,
        "(tuple (action \"transfer\") (caller 'SP3TCNH1X2YSSC5KYE6B5N2PSN5T1BSPPBS235ZP9) (data (tuple (amount u10) (memo none) (recipient 'SP3MCM8K9KEJMFM6MN191JVN5CA51MDS7AM3SGYQ6) (sender 'SP3TCNH1X2YSSC5KYE6B5N2PSN5T1BSPPBS235ZP9))))"
      );
      assert.ok(op.metadata.contract_identifier, 'Should have contract_identifier');
      assert.strictEqual(op.metadata.topic, 'print');
      assert.strictEqual(op.status, 'success');

      // Verify FT transfer operations
      const ftTransferOps = tx.operations.filter(
        (op: { type: string; amount?: { currency?: { metadata?: { token_type: string } } } }) =>
          op.type === 'token_transfer' && op.amount?.currency?.metadata?.token_type === 'ft'
      );
      assert.ok(ftTransferOps.length > 0, 'Expected FT transfer operations');
      // FT transfers come in send/receive pairs
      assert.strictEqual(ftTransferOps.length % 2, 0, 'FT transfers should come in pairs');
    });
  });

  describe('/block/transaction', () => {
    test('should return a specific transaction from a block', async () => {
      const fixture = loadFixture('blocks/token-transfer.json');
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const txHash = fixture.transactions[0].txid;
      const response = await postBlockTransaction(fastify, fixture.block_id, txHash);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const tx = json.transaction;

      assert.strictEqual(tx.transaction_identifier.hash, `0x${txHash}`);
      assert.strictEqual(tx.metadata.type, 'token_transfer');
      assert.strictEqual(tx.metadata.status, 'success');
      assert.strictEqual(tx.operations.length, 3); // fee + send + receive
    });

    test('should return a specific contract call from a multi-tx block', async () => {
      const fixture = loadFixture('blocks/contract-call.json');
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      // Get the contract call tx (second transaction - has ft_mint)
      const txHash = fixture.transactions[1].txid;
      const response = await postBlockTransaction(fastify, fixture.block_id, txHash);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);
      const tx = json.transaction;

      assert.strictEqual(tx.transaction_identifier.hash, `0x${txHash}`);
      assert.strictEqual(tx.metadata.type, 'contract_call');
      assert.strictEqual(tx.metadata.position.index, 1);
      assert.strictEqual(tx.operations.length, 3); // fee + contract_call + ft_mint
    });
  });

  describe('execution cost metadata', () => {
    test('should include execution cost in transaction metadata', async () => {
      const fixture = loadFixture('blocks/contract-call.json');
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      // Check the contract call tx (index 1) which has non-zero execution costs
      const tx = json.block.transactions[1];
      assert.deepStrictEqual(tx.metadata.execution_cost, {
        write_length: 300,
        write_count: 5,
        read_length: 7395,
        read_count: 15,
        runtime: 47833,
      });
    });
  });

  describe('operation index consistency', () => {
    test('should have sequential operation indices', async () => {
      const fixture = loadFixture('blocks/contract-call.json');
      const mockPool = mockAgent.get('http://test.stacks.node:20444');
      mockReplay(mockPool, fixture.block_id, fixture);

      const response = await postBlock(fastify, fixture.block_id);
      assert.strictEqual(response.statusCode, 200);
      const json = JSON.parse(response.body);

      for (const tx of json.block.transactions) {
        for (let i = 0; i < tx.operations.length; i++) {
          assert.strictEqual(
            tx.operations[i].operation_identifier.index,
            i,
            `Operation index mismatch in tx ${tx.transaction_identifier.hash} at position ${i}`
          );
        }
      }
    });
  });
});
