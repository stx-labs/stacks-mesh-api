import { Static, Type } from '@sinclair/typebox';

export const ErrorResponseSchema = Type.Object({
  code: Type.Number(),
  message: Type.String(),
  description: Type.Optional(Type.String()),
  retriable: Type.Boolean(),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
