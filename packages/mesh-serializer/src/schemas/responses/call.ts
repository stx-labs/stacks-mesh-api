import { Static, Type } from "@sinclair/typebox";

export const CallResponseSchema = Type.Object({
  result: Type.Record(Type.String(), Type.Unknown()),
  idempotent: Type.Boolean(),
});
export type CallResponse = Static<typeof CallResponseSchema>;
