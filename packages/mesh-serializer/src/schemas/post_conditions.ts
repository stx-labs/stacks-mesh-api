import { Static, Type } from '@sinclair/typebox';

export const StacksPostConditionModeSchema = Type.Union([
  Type.Literal('allow'),
  Type.Literal('deny'),
]);
export type StacksPostConditionMode = Static<
  typeof StacksPostConditionModeSchema
>;

const StacksFungiblePostConditionCodeSchema = Type.Union([
  Type.Literal('sent_equal_to'),
  Type.Literal('sent_greater_than'),
  Type.Literal('sent_greater_than_or_equal_to'),
  Type.Literal('sent_less_than'),
  Type.Literal('sent_less_than_or_equal_to'),
]);
export type StacksFungiblePostConditionCode = Static<
  typeof StacksFungiblePostConditionCodeSchema
>;

const StacksNonFungiblePostConditionCodeSchema = Type.Union([
  Type.Literal('sent'),
  Type.Literal('not_sent'),
]);
export type StacksNonFungiblePostConditionCode = Static<
  typeof StacksNonFungiblePostConditionCodeSchema
>;

const StacksPostConditionPrincipalStandardSchema = Type.Object({
  type_id: Type.Literal('principal_standard'),
  address: Type.String(),
});
export type StacksPostConditionPrincipalStandard = Static<
  typeof StacksPostConditionPrincipalStandardSchema
>;

const StacksPostConditionPrincipalContractSchema = Type.Object({
  type_id: Type.Literal('principal_contract'),
  contract_name: Type.String(),
  address: Type.String(),
});
export type StacksPostConditionPrincipalContract = Static<
  typeof StacksPostConditionPrincipalContractSchema
>;

const StacksPostConditionPrincipalOriginSchema = Type.Object({
  type_id: Type.Literal('principal_origin'),
});
export type StacksPostConditionPrincipalOrigin = Static<
  typeof StacksPostConditionPrincipalOriginSchema
>;

const StacksPostConditionPrincipalSchema = Type.Union([
  StacksPostConditionPrincipalStandardSchema,
  StacksPostConditionPrincipalContractSchema,
  StacksPostConditionPrincipalOriginSchema,
]);
export type StacksPostConditionPrincipal = Static<
  typeof StacksPostConditionPrincipalSchema
>;

const StacksPostConditionAssetSchema = Type.Object({
  contract_name: Type.String(),
  asset_name: Type.String(),
  contract_address: Type.String(),
});
export type StacksPostConditionAsset = Static<
  typeof StacksPostConditionAssetSchema
>;

const StacksStxPostConditionSchema = Type.Object({
  type: Type.Literal('stx'),
  condition_code: StacksFungiblePostConditionCodeSchema,
  amount: Type.String(),
  principal: StacksPostConditionPrincipalSchema,
});
export type StacksStxPostCondition = Static<
  typeof StacksStxPostConditionSchema
>;

const StacksFungiblePostConditionSchema = Type.Object({
  type: Type.Literal('fungible'),
  condition_code: StacksFungiblePostConditionCodeSchema,
  amount: Type.String(),
  principal: StacksPostConditionPrincipalSchema,
  asset: StacksPostConditionAssetSchema,
});
export type StacksFungiblePostCondition = Static<
  typeof StacksFungiblePostConditionSchema
>;

const StacksNonFungiblePostConditionSchema = Type.Object({
  type: Type.Literal('non_fungible'),
  condition_code: StacksNonFungiblePostConditionCodeSchema,
  principal: StacksPostConditionPrincipalSchema,
  asset: StacksPostConditionAssetSchema,
  asset_value: Type.Object({
    hex: Type.String(),
    repr: Type.String(),
  }),
});
export type StacksNonFungiblePostCondition = Static<
  typeof StacksNonFungiblePostConditionSchema
>;

export const StacksPostConditionSchema = Type.Union([
  StacksStxPostConditionSchema,
  StacksFungiblePostConditionSchema,
  StacksNonFungiblePostConditionSchema,
]);
export type StacksPostCondition = Static<typeof StacksPostConditionSchema>;
