import { Static, Type } from "@sinclair/typebox";

const BaseCallResponseSchema = Type.Object({
  idempotent: Type.Boolean(),
});

export const ContractCallReadOnlyResponseSchema = Type.Composite([
  BaseCallResponseSchema,
  Type.Object({
    result: Type.Union([
      Type.Object({
        okay: Type.Literal(true),
        result: Type.String(),
      }),
      Type.Object({
        okay: Type.Literal(false),
        cause: Type.String(),
      }),
    ]),
  }),
]);
export type ContractCallReadOnlyResponse = Static<typeof ContractCallReadOnlyResponseSchema>;

export const CallResponseSchema = Type.Union([ContractCallReadOnlyResponseSchema]);
export type CallResponse = Static<typeof CallResponseSchema>;
