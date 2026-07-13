// Enums are NAMED exports of @stacks/codec (not on the default export), so they must
// be imported by name — `PostConditionAssetInfoID` is `undefined` at runtime.
import {
  PostConditionAssetInfoID,
  PostConditionModeID,
  PostConditionPrincipalTypeID,
  type PostConditionPrincipal as CodecPostConditionPrincipal,
  type TxPostCondition,
} from '@stacks/codec';
import { PostCondition, PostConditionMode, PostConditionPrincipal } from '@stacks/mesh-schemas';
import { DecodedStacksTransaction } from './transactions.js';
import { addHexPrefix } from './index.js';

export function serializePostConditions(tx: DecodedStacksTransaction) {
  const serializePostConditionPrincipal = (
    principal: CodecPostConditionPrincipal
  ): PostConditionPrincipal => {
    if (principal.type_id === PostConditionPrincipalTypeID.Standard) {
      return {
        type_id: 'principal_standard',
        address: principal.address,
      };
    }
    if (principal.type_id === PostConditionPrincipalTypeID.Contract) {
      return {
        type_id: 'principal_contract',
        contract_name: principal.contract_name,
        address: principal.address,
      };
    }
    return {
      type_id: 'principal_origin',
    };
  };
  const serializePostCondition = (pc: TxPostCondition): PostCondition => {
    switch (pc.asset_info_id) {
      case PostConditionAssetInfoID.STX:
        return {
          type: 'stx',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
        };
      case PostConditionAssetInfoID.FungibleAsset:
        return {
          type: 'fungible',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
          asset: {
            contract_name: pc.asset.contract_name,
            asset_name: pc.asset.asset_name,
            contract_address: pc.asset.contract_address,
          },
        };
      case PostConditionAssetInfoID.NonfungibleAsset:
        return {
          type: 'non_fungible',
          condition_code: pc.condition_name,
          principal: serializePostConditionPrincipal(pc.principal),
          asset: {
            contract_name: pc.asset.contract_name,
            asset_name: pc.asset.asset_name,
            contract_address: pc.asset.contract_address,
          },
          asset_value: {
            hex: addHexPrefix(pc.asset_value.hex),
            repr: pc.asset_value.repr,
          },
        };
      case PostConditionAssetInfoID.Staking:
        // pox-5: constrains how much STX may be staked — STX-like (amount + fungible code).
        return {
          type: 'staking',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
        };
      case PostConditionAssetInfoID.Pox:
        // pox-5: constrains a position-altering PoX operation (no amount).
        return {
          type: 'pox',
          condition_code: pc.condition_name,
          principal: serializePostConditionPrincipal(pc.principal),
        };
    }
  };
  const serializePostConditionMode = (mode: PostConditionModeID): PostConditionMode => {
    switch (mode) {
      case PostConditionModeID.Allow:
        return 'allow';
      case PostConditionModeID.Deny:
        return 'deny';
      case PostConditionModeID.Originator:
        return 'originator';
    }
  };
  const decodedPostConditions = tx.decodedTx.post_conditions;
  const normalizedPostConditions = decodedPostConditions.map(pc => serializePostCondition(pc));
  return {
    mode: serializePostConditionMode(tx.decodedTx.post_condition_mode),
    post_conditions: normalizedPostConditions,
  };
}
