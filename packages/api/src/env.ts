import { Static, Type } from '@sinclair/typebox';
import envSchema from 'env-schema';

const schema = Type.Object({
  /** Hostname of the API server */
  API_HOST: Type.String({ default: '0.0.0.0' }),
  /** Port in which to serve the API */
  API_PORT: Type.Number({ default: 3000, minimum: 0, maximum: 65535 }),

  /**
   * API mode. `online` (default) connects to a Stacks node and serves the full API. `offline`
   * serves only the endpoints that need no chain state and makes no outbound calls (the offline
   * subset of the Construction API, plus `/network/list` and `/network/options`) — for air-gapped
   * transaction construction/signing.
   */
  MODE: Type.Union([Type.Literal('online'), Type.Literal('offline')], { default: 'online' }),

  /** Scheme of the Stacks Core RPC server */
  STACKS_CORE_RPC_SCHEME: Type.String({ default: 'http' }),
  /** Hostname of the Stacks Core RPC server. Required in `online` mode. */
  STACKS_CORE_RPC_HOST: Type.Optional(Type.String()),
  /** Port for the Stacks Core RPC server */
  STACKS_CORE_RPC_PORT: Type.Integer({ default: 20443, minimum: 0, maximum: 65535 }),
  /** Auth token for the Stacks Core RPC server. Required in `online` mode. */
  STACKS_CORE_RPC_AUTH_TOKEN: Type.Optional(Type.String()),
  /**
   * Chain ID of the target network, used for transaction construction/signing. Required in
   * `offline` mode (there's no node to read `/v2/info` `network_id` from); ignored in `online`
   * mode, where it always comes from the node. Any non-mainnet value resolves to testnet format.
   */
  STACKS_CHAIN_ID: Type.Optional(Type.Integer({ minimum: 0 })),

  /**
   * Which block hash to display in responses. `index_block_hash` (default) is the canonical Stacks
   * block identifier. `block_hash` displays the (Bitcoin-anchored) Stacks block hash instead, for
   * backwards compatibility with systems that key on it. Node RPCs always operate on the
   * index_block_hash, so in `block_hash` mode a point lookup by hash must also include the block
   * index (the node cannot resolve a bare block_hash).
   */
  BLOCK_HASH_MODE: Type.Union([Type.Literal('index_block_hash'), Type.Literal('block_hash')], {
    default: 'index_block_hash',
  }),

  /** Size of the token metadata cache. Defaults to 1000. */
  TOKEN_METADATA_CACHE_SIZE: Type.Integer({ default: 1000, minimum: 0 }),
  /** TTL of the token metadata cache in milliseconds. Defaults to 24 hours. */
  TOKEN_METADATA_CACHE_TTL_MS: Type.Integer({ default: 1000 * 60 * 60 * 24, minimum: 0 }),
  /**
   * TTL (ms) for negatively-cached token metadata lookups — tokens whose SIP-010 getters failed.
   * Kept short so a transient failure recovers, while a persistently non-standard token isn't
   * re-queried on every occurrence. Defaults to 2 hours.
   */
  TOKEN_METADATA_ERROR_CACHE_TTL_MS: Type.Integer({ default: 1000 * 60 * 60 * 2, minimum: 0 }),
  /** Size of the contract ABI cache. Defaults to 100. */
  CONTRACT_ABI_CACHE_SIZE: Type.Integer({ default: 100, minimum: 0 }),
  /** TTL of the contract ABI cache in milliseconds. Defaults to 24 hours. */
  CONTRACT_ABI_CACHE_TTL_MS: Type.Integer({ default: 1000 * 60 * 60 * 24, minimum: 0 }),
});
type Env = Static<typeof schema>;

export const ENV = envSchema<Env>({
  schema: schema,
  dotenv: true,
});
