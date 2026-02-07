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

export const ContractGetInterfaceResponseSchema = Type.Composite([
  BaseCallResponseSchema,
  Type.Object({
    result: Type.Record(Type.String(), Type.Unknown()),
  }),
]);
export type ContractGetInterfaceResponse = Static<typeof ContractGetInterfaceResponseSchema>;

export const ContractGetSourceResponseSchema = Type.Composite([
  BaseCallResponseSchema,
  Type.Object({
    result: Type.Object({
      source: Type.String(),
      publish_height: Type.Integer(),
      proof: Type.Optional(Type.String()),
    }),
  }),
]);
export type ContractGetSourceResponse = Static<typeof ContractGetSourceResponseSchema>;

export const ContractGetConstantValResponseSchema = Type.Composite([
  BaseCallResponseSchema,
  Type.Object({
    result: Type.Object({
      okay: Type.Literal(true),
      result: Type.Object({
        data: Type.String(),
      }),
    }),
  }),
]);
export type ContractGetConstantValResponse = Static<typeof ContractGetConstantValResponseSchema>;

export const CallResponseSchema = Type.Union([
  ContractCallReadOnlyResponseSchema,
  ContractGetInterfaceResponseSchema,
  ContractGetSourceResponseSchema,
  ContractGetConstantValResponseSchema,
]);
export type CallResponse = Static<typeof CallResponseSchema>;
