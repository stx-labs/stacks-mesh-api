import { serializeTransaction, StacksTransactionWire } from '@stacks/transactions';

/** Per-byte fee rate (µSTX) used to size-estimate a transaction fee. */
export const FEE_RATE_PER_BYTE = 1;

/**
 * Reorder a Rosetta `ecdsa_recovery` signature into the byte order Stacks expects.
 *
 * Rosetta clients produce `[R (32) | S (32) | recoveryId (1)]` (recovery byte last), but a Stacks
 * recoverable signature is `[recoveryId (1) | R (32) | S (32)]` (recovery byte first). Without this
 * the node reads the first byte of R as the recovery id and rejects the tx
 * (`SignatureValidation: failed to decode recoverable signature`).
 *
 * @param signatureHex - 65-byte signature as 130 hex chars, no `0x` prefix, in `[R|S|V]` order.
 * @returns the same bytes reordered to `[V|R|S]`.
 */
export function reorderSignatureToVrs(signatureHex: string): string {
  // 130 hex chars = 65 bytes: R|S = first 128, recovery id = last 2.
  return signatureHex.slice(128) + signatureHex.slice(0, 128);
}

/**
 * Estimate a transaction's fee from its full serialized byte length and a per-byte fee rate, with a
 * floor (`defaultFee`). The size is taken from the *whole* serialized transaction (not just the
 * payload) — the unsigned tx already includes the fixed-size signature field, so its length matches
 * the signed size — which is what the node's min relay fee is computed against.
 *
 * @param defaultFee - Floor/fallback fee (µSTX), from `CONSTRUCTION_DEFAULT_FEE`.
 */
export function estimateTransactionFee(
  tx: StacksTransactionWire,
  defaultFee: number,
  feeRatePerByte: number = FEE_RATE_PER_BYTE
): number {
  const byteLength = serializeTransaction(tx).length / 2; // serialize returns bare hex
  return Math.max(defaultFee, Math.ceil(byteLength * feeRatePerByte));
}
