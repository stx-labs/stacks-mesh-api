import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TxPayloadTypeID, type DecodedTxResult } from '@stacks/codec';
import type { BlockReplayTransaction } from '@stacks/rpc-client';
import type { ApiConfig } from '../../src/api/index.js';
import { prefetchBlockMetadata } from '../../src/serializers/transactions.js';

function contractCallTx(address: string, contractName: string): DecodedTxResult {
  return {
    payload: { type_id: TxPayloadTypeID.ContractCall, address, contract_name: contractName },
  } as unknown as DecodedTxResult;
}
function transferTx(): DecodedTxResult {
  return { payload: { type_id: TxPayloadTypeID.TokenTransfer } } as unknown as DecodedTxResult;
}
function ftTransferEvent(asset: string) {
  return { type: 'ft_transfer_event', ft_transfer_event: { asset_identifier: asset } };
}
function txWithEvents(events: unknown[]): BlockReplayTransaction {
  return { events } as unknown as BlockReplayTransaction;
}

// Records which identifiers each cache was asked for, so we can assert dedup + coverage.
function makeSpyConfig() {
  const abiGets: string[] = [];
  const tokenGets: string[] = [];
  const config = {
    contractAbiCache: { get: async (id: string) => void abiGets.push(id) },
    tokenMetadataCache: { get: async (id: string) => void tokenGets.push(id) },
  } as unknown as ApiConfig;
  return { config, abiGets, tokenGets };
}

describe('prefetchBlockMetadata', () => {
  test('warms each unique contract ABI and FT asset exactly once', async () => {
    const { config, abiGets, tokenGets } = makeSpyConfig();

    // Two txs call the same contract; a third calls a different one; a plain transfer calls none.
    const decodedTxs = [
      contractCallTx('SP1', 'amm'),
      contractCallTx('SP1', 'amm'),
      contractCallTx('SP2', 'pool'),
      transferTx(),
    ];
    // FT events repeat the same asset across txs, plus a distinct one; non-FT events are ignored.
    const transactions = [
      txWithEvents([ftTransferEvent('SP1.tok::a'), { type: 'stx_transfer_event' }]),
      txWithEvents([ftTransferEvent('SP1.tok::a')]),
      txWithEvents([{ type: 'ft_mint_event', ft_mint_event: { asset_identifier: 'SP3.usd::b' } }]),
    ];

    await prefetchBlockMetadata(transactions, decodedTxs, config);

    assert.deepEqual([...abiGets].sort(), ['SP1.amm', 'SP2.pool']);
    assert.deepEqual([...tokenGets].sort(), ['SP1.tok::a', 'SP3.usd::b']);
  });

  test('no contracts or FT assets → no cache calls', async () => {
    const { config, abiGets, tokenGets } = makeSpyConfig();
    await prefetchBlockMetadata([txWithEvents([])], [transferTx()], config);
    assert.equal(abiGets.length, 0);
    assert.equal(tokenGets.length, 0);
  });
});
