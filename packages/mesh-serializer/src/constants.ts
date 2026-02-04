import type { Currency } from './types.js';

// Stacks blockchain constants
export const STACKS_DECIMALS = 6;
export const STACKS_SYMBOL = 'STX';

// Default STX currency for Stacks blockchain
export const STX_CURRENCY: Currency = {
  symbol: STACKS_SYMBOL,
  decimals: STACKS_DECIMALS,
};
