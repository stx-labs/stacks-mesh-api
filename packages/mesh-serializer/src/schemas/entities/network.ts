import { Static, Type } from '@sinclair/typebox';

export const NetworkIdentifierSchema = Type.Object({
  blockchain: Type.String(),
  network: Type.String(),
  sub_network_identifier: Type.Optional(
    Type.Object({
      network: Type.String(),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    })
  ),
});
export type NetworkIdentifier = Static<typeof NetworkIdentifierSchema>;
