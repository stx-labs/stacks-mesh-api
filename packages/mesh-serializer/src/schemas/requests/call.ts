import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";

export const CallRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  method: Type.String(),
  parameters: Type.Record(Type.String(), Type.Unknown()),
});
export type CallRequest = Static<typeof CallRequestSchema>;
