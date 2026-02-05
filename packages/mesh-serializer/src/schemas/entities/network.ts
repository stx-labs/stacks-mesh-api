import { Static, Type } from '@sinclair/typebox';

export const NetworkIdentifierSchema = Type.Object({
  blockchain: Type.Literal('stacks'),
  network: Type.Union([Type.Literal('mainnet'), Type.Literal('testnet')]),
});
export type NetworkIdentifier = Static<typeof NetworkIdentifierSchema>;
