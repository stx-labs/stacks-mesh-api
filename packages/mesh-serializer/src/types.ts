// Mesh API Types based on Coinbase Mesh Specification
// These are the core types needed for serialization

export interface BlockIdentifier {
  index: number;
  hash: string;
}

export interface TransactionIdentifier {
  hash: string;
}

export interface AccountIdentifier {
  address: string;
  sub_account?: SubAccountIdentifier;
  metadata?: Record<string, unknown>;
}

export interface SubAccountIdentifier {
  address: string;
  metadata?: Record<string, unknown>;
}

export interface OperationIdentifier {
  index: number;
  network_index?: number;
}

export interface Currency {
  symbol: string;
  decimals: number;
  metadata?: Record<string, unknown>;
}

export interface Amount {
  value: string;
  currency: Currency;
  metadata?: Record<string, unknown>;
}

export interface CoinIdentifier {
  identifier: string;
}

export interface CoinChange {
  coin_identifier: CoinIdentifier;
  coin_action: CoinAction;
}

export type CoinAction = 'coin_created' | 'coin_spent';

export interface Operation {
  operation_identifier: OperationIdentifier;
  related_operations?: OperationIdentifier[];
  type: string;
  status?: string;
  account?: AccountIdentifier;
  amount?: Amount;
  coin_change?: CoinChange;
  metadata?: Record<string, unknown>;
}

export interface Transaction {
  transaction_identifier: TransactionIdentifier;
  operations: Operation[];
  related_transactions?: RelatedTransaction[];
  metadata?: Record<string, unknown>;
}

export interface RelatedTransaction {
  network_identifier?: NetworkIdentifier;
  transaction_identifier: TransactionIdentifier;
  direction: Direction;
}

export type Direction = 'forward' | 'backward';

export interface NetworkIdentifier {
  blockchain: string;
  network: string;
  sub_network_identifier?: SubNetworkIdentifier;
}

export interface SubNetworkIdentifier {
  network: string;
  metadata?: Record<string, unknown>;
}

export interface Block {
  block_identifier: BlockIdentifier;
  parent_block_identifier: BlockIdentifier;
  timestamp: number;
  transactions: Transaction[];
  metadata?: Record<string, unknown>;
}
