import { Static, Type } from '@sinclair/typebox';

export const PostConditionModeSchema = Type.Union([
  Type.Literal('allow'),
  Type.Literal('deny'),
  Type.Literal('originator'),
]);
export type PostConditionMode = Static<typeof PostConditionModeSchema>;

const FungiblePostConditionCodeSchema = Type.Union([
  Type.Literal('sent_equal_to'),
  Type.Literal('sent_greater_than'),
  Type.Literal('sent_greater_than_or_equal_to'),
  Type.Literal('sent_less_than'),
  Type.Literal('sent_less_than_or_equal_to'),
]);
export type FungiblePostConditionCode = Static<typeof FungiblePostConditionCodeSchema>;

const NonFungiblePostConditionCodeSchema = Type.Union([
  Type.Literal('sent'),
  Type.Literal('not_sent'),
  Type.Literal('maybe_sent'),
]);
export type NonFungiblePostConditionCode = Static<typeof NonFungiblePostConditionCodeSchema>;

const PostConditionPrincipalStandardSchema = Type.Object({
  type_id: Type.Literal('principal_standard'),
  address: Type.String(),
});
export type PostConditionPrincipalStandard = Static<typeof PostConditionPrincipalStandardSchema>;

const PostConditionPrincipalContractSchema = Type.Object({
  type_id: Type.Literal('principal_contract'),
  contract_name: Type.String(),
  address: Type.String(),
});
export type PostConditionPrincipalContract = Static<typeof PostConditionPrincipalContractSchema>;

const PostConditionPrincipalOriginSchema = Type.Object({
  type_id: Type.Literal('principal_origin'),
});
export type PostConditionPrincipalOrigin = Static<typeof PostConditionPrincipalOriginSchema>;

const PostConditionPrincipalSchema = Type.Union([
  PostConditionPrincipalStandardSchema,
  PostConditionPrincipalContractSchema,
  PostConditionPrincipalOriginSchema,
]);
export type PostConditionPrincipal = Static<typeof PostConditionPrincipalSchema>;

const PostConditionAssetSchema = Type.Object({
  contract_name: Type.String(),
  asset_name: Type.String(),
  contract_address: Type.String(),
});
export type PostConditionAsset = Static<typeof PostConditionAssetSchema>;

const StxPostConditionSchema = Type.Object({
  type: Type.Literal('stx'),
  condition_code: FungiblePostConditionCodeSchema,
  amount: Type.String(),
  principal: PostConditionPrincipalSchema,
});
export type StxPostCondition = Static<typeof StxPostConditionSchema>;

const FungiblePostConditionSchema = Type.Object({
  type: Type.Literal('fungible'),
  condition_code: FungiblePostConditionCodeSchema,
  amount: Type.String(),
  principal: PostConditionPrincipalSchema,
  asset: PostConditionAssetSchema,
});
export type FungiblePostCondition = Static<typeof FungiblePostConditionSchema>;

const NonFungiblePostConditionSchema = Type.Object({
  type: Type.Literal('non_fungible'),
  condition_code: NonFungiblePostConditionCodeSchema,
  principal: PostConditionPrincipalSchema,
  asset: PostConditionAssetSchema,
  asset_value: Type.Object({
    hex: Type.String(),
    repr: Type.String(),
  }),
});
export type NonFungiblePostCondition = Static<typeof NonFungiblePostConditionSchema>;

// pox-5 (epoch 4.0+) post conditions.
const PoxPostConditionCodeSchema = Type.Union([
  Type.Literal('not_performed'),
  Type.Literal('maybe_performed'),
  Type.Literal('performed'),
]);
export type PoxPostConditionCode = Static<typeof PoxPostConditionCodeSchema>;

// Constrains how much STX a principal may stake (lock for PoX) — same shape as an
// STX post condition (fungible condition code + amount).
const StakingPostConditionSchema = Type.Object({
  type: Type.Literal('staking'),
  condition_code: FungiblePostConditionCodeSchema,
  amount: Type.String(),
  principal: PostConditionPrincipalSchema,
});
export type StakingPostCondition = Static<typeof StakingPostConditionSchema>;

// Constrains whether a principal may perform a position-altering PoX operation
// (unstake / unstake-sbtc / update-bond-registration / announce-l1-early-exit).
const PoxPostConditionSchema = Type.Object({
  type: Type.Literal('pox'),
  condition_code: PoxPostConditionCodeSchema,
  principal: PostConditionPrincipalSchema,
});
export type PoxPostCondition = Static<typeof PoxPostConditionSchema>;

export const PostConditionSchema = Type.Union([
  StxPostConditionSchema,
  FungiblePostConditionSchema,
  NonFungiblePostConditionSchema,
  StakingPostConditionSchema,
  PoxPostConditionSchema,
]);
export type PostCondition = Static<typeof PostConditionSchema>;
