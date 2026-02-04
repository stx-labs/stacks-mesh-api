import { NetworkIdentifierSchema } from "../entities/network.js";
import { Static, Type } from "@sinclair/typebox";

export const MetadataRequestSchema = Type.Object({
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type MetadataRequest = Static<typeof MetadataRequestSchema>;

export const NetworkRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type NetworkRequest = Static<typeof NetworkRequestSchema>;
