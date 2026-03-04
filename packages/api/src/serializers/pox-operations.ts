import { Operation } from '@stacks/mesh-schemas';
import codec from '@stacks/codec';
import { StacksBlockReplayTransactionContractEvent } from '../stacks-rpc/types.js';
import { PoxContractIdentifiers } from '../utils/constants.js';
import { DecodedStacksTransaction, makeStxCurrency } from './transactions.js';

export function isPoxPrintEvent(event: StacksBlockReplayTransactionContractEvent): boolean {
  if (event.contract_event.topic !== 'print') return false;
  return PoxContractIdentifiers.includes(event.contract_event.contract_identifier);
}

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
    case codec.PoxEventName.DelegateStackStx:
      return {
        operation_identifier: { index: index + 1 },
        type: 'delegate_stack_stx',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.lock_amount,
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
          delegator: poxEvent.data.delegator,
          lock_period: poxEvent.data.lock_period,
          burnchain_start_height: poxEvent.data.start_burn_height
            ? parseInt(poxEvent.data.start_burn_height)
            : null,
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
    case codec.PoxEventName.StackAggregationCommit:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_aggregation_commit',
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
    case codec.PoxEventName.HandleUnlock:
      return {
        operation_identifier: { index: index + 1 },
        type: 'handle_unlock',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          first_cycle_locked: parseInt(poxEvent.data.first_cycle_locked),
          first_unlocked_cycle: parseInt(poxEvent.data.first_unlocked_cycle),
        },
      };
    case codec.PoxEventName.StackStx:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_stx',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        amount: {
          value: poxEvent.data.lock_amount,
          currency: makeStxCurrency(),
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          lock_period: parseInt(poxEvent.data.lock_period),
          burnchain_start_height: parseInt(poxEvent.data.start_burn_height),
          signer_key: poxEvent.data.signer_key,
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
        },
      };
    case codec.PoxEventName.StackIncrease:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_increase',
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
          signer_key: poxEvent.data.signer_key,
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
        },
      };
    case codec.PoxEventName.StackExtend:
      return {
        operation_identifier: { index: index + 1 },
        type: 'stack_extend',
        status: tx.status,
        account: {
          address: poxEvent.stacker,
        },
        metadata: {
          locked: poxEvent.locked,
          balance: poxEvent.balance,
          burnchain_unlock_height: parseInt(poxEvent.burnchain_unlock_height),
          extend_count: parseInt(poxEvent.data.extend_count),
          start_cycle_id: poxEvent.data.start_cycle_id
            ? parseInt(poxEvent.data.start_cycle_id)
            : null,
          end_cycle_id: poxEvent.data.end_cycle_id ? parseInt(poxEvent.data.end_cycle_id) : null,
        },
      };
  }
}
