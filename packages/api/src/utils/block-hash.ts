/**
 * Which block hash the API displays in responses.
 * - `index_block_hash` (default): the canonical Stacks block identifier (a.k.a. `block_id` in some
 *   node RPC responses). This is what node RPCs operate on.
 * - `block_hash`: the Stacks block hash, for backwards compatibility with systems that key on it.
 */
export type BlockHashMode = 'index_block_hash' | 'block_hash';

/**
 * Pick which hash to show for a block, given the configured mode. Callers must supply both hashes
 * (they always come together from a block replay or a decoded block header). The internal
 * `index_block_hash` is still what's used to talk to the node — this only affects what is displayed.
 */
export function selectDisplayBlockHash(
  mode: BlockHashMode,
  hashes: { indexBlockHash: string; blockHash: string }
): string {
  return mode === 'block_hash' ? hashes.blockHash : hashes.indexBlockHash;
}
