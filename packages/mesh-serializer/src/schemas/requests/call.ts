import { Optional } from '../entities/common.js';
import { NetworkIdentifierSchema } from '../entities/network.js';
import { Static, Type } from '@sinclair/typebox';

const BaseCallRequestSchema = Type.Object({
  network_identifier: NetworkIdentifierSchema,
});

export const ContractCallReadOnlyRequestSchema = Type.Composite([
  BaseCallRequestSchema,
  Type.Object({
    method: Type.Literal('contract_call_read_only'),
    parameters: Type.Object({
      deployer_address: Type.String(),
      contract_name: Type.String(),
      function_name: Type.String(),
      sender: Type.String(),
      sponsor: Optional(Type.String()),
      arguments: Type.Array(Type.String()),
    }),
  }),
]);
export type ContractCallReadOnlyRequest = Static<typeof ContractCallReadOnlyRequestSchema>;

export const ContractGetInterfaceRequestSchema = Type.Composite([
  BaseCallRequestSchema,
  Type.Object({
    method: Type.Literal('contract_get_interface'),
    parameters: Type.Object({
      deployer_address: Type.String(),
      contract_name: Type.String(),
    }),
  }),
]);
export type ContractGetInterfaceRequest = Static<typeof ContractGetInterfaceRequestSchema>;

export const ContractGetSourceRequestSchema = Type.Composite([
  BaseCallRequestSchema,
  Type.Object({
    method: Type.Literal('contract_get_source'),
    parameters: Type.Object({
      deployer_address: Type.String(),
      contract_name: Type.String(),
    }),
  }),
]);
export type ContractGetSourceRequest = Static<typeof ContractGetSourceRequestSchema>;

export const ContractGetConstantValRequestSchema = Type.Composite([
  BaseCallRequestSchema,
  Type.Object({
    method: Type.Literal('contract_get_constant_val'),
    parameters: Type.Object({
      deployer_address: Type.String(),
      contract_name: Type.String(),
      constant_name: Type.String(),
    }),
  }),
]);
export type ContractGetConstantValRequest = Static<typeof ContractGetConstantValRequestSchema>;

export const ContractGetDataVarRequestSchema = Type.Composite([
  BaseCallRequestSchema,
  Type.Object({
    method: Type.Literal('contract_get_data_var'),
    parameters: Type.Object({
      deployer_address: Type.String(),
      contract_name: Type.String(),
      var_name: Type.String(),
    }),
  }),
]);
export type ContractGetDataVarRequest = Static<typeof ContractGetDataVarRequestSchema>;

export const CallRequestSchema = Type.Union([
  ContractCallReadOnlyRequestSchema,
  ContractGetInterfaceRequestSchema,
  ContractGetSourceRequestSchema,
  ContractGetConstantValRequestSchema,
  ContractGetDataVarRequestSchema,
]);
export type CallRequest = Static<typeof CallRequestSchema>;
