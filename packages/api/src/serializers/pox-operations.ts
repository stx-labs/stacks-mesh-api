import { Operation } from '@stacks/mesh-schemas';
import codec from '@stacks/codec';
import { DecodedStacksTransaction, makeStxCurrency } from './index.js';

export function makeSyntheticPoxOperation(
  poxEvent: codec.DecodedPoxSyntheticEvent,
  index: number,
  tx: DecodedStacksTransaction
): Operation {
  switch (poxEvent.name) {
    case codec.PoxEventName.DelegateStx:
      return {
        operation_identifier: { index: index + 1 },
        type: 'delegate_stx',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          delegate_to: poxEvent.data.delegate_to,
          unlock_burn_height: poxEvent.data.unlock_burn_height
            ? parseInt(poxEvent.data.unlock_burn_height)
            : null,
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
        },
      };
    case codec.PoxEventName.DelegateStackIncrease:
      return {
        operation_identifier: { index: index + 1 },
        type: 'delegate_stack_increase',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.increase_by,
          currency: makeStxCurrency(),
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          delegator: poxEvent.data.delegator,
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
        },
      };
    case codec.PoxEventName.RevokeDelegateStx:
      return {
        operation_identifier: { index: index + 1 },
        type: 'revoke_delegate_stx',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
          delegate_to: poxEvent.data.delegate_to,
          pox_addr: poxEvent.pox_addr ?? undefined,
          pox_addr_raw: poxEvent.pox_addr_raw ?? undefined,
        },
      };
    case codec.PoxEventName.StackAggregationIncrease:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_aggregation_increase',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
          reward_cycle: parseInt(poxEvent.data.reward_cycle),
        },
      };
    case codec.PoxEventName.StackAggregationCommitIndexed:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_aggregation_commit_indexed',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.amount_ustx,
          currency: makeStxCurrency(),
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
          reward_cycle: parseInt(poxEvent.data.reward_cycle),
          signer_key: poxEvent.data.signer_key,
        },
      };
    case codec.PoxEventName.DelegateStackExtend:
      return {
        operation_identifier: { index: index + 1 },
        type: 'delegate_stack_extend',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
          extend_count: parseInt(poxEvent.data.extend_count),
          delegator: poxEvent.data.delegator,
        },
      };
  }
  throw new Error();
}
