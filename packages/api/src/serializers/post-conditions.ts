import codec, { PostConditionModeID } from '@stacks/codec';
import { PostCondition, PostConditionMode, PostConditionPrincipal } from '@stacks/mesh-schemas';
import { DecodedStacksTransaction } from './transactions.js';

export function serializePostConditions(tx: DecodedStacksTransaction) {
  const serializePostConditionPrincipal = (
    principal: codec.PostConditionPrincipal
  ): PostConditionPrincipal => {
    if (principal.type_id === codec.PostConditionPrincipalTypeID.Standard) {
      return {
        type_id: 'principal_standard',
        address: principal.address,
      };
    }
    if (principal.type_id === codec.PostConditionPrincipalTypeID.Contract) {
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
  const serializePostCondition = (pc: codec.TxPostCondition): PostCondition => {
    switch (pc.asset_info_id) {
      case codec.PostConditionAssetInfoID.STX:
        return {
          type: 'stx',
          condition_code: pc.condition_name,
          amount: pc.amount,
          principal: serializePostConditionPrincipal(pc.principal),
        };
      case codec.PostConditionAssetInfoID.FungibleAsset:
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
      case codec.PostConditionAssetInfoID.NonfungibleAsset:
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
            hex: pc.asset_value.hex,
            repr: pc.asset_value.repr,
          },
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
