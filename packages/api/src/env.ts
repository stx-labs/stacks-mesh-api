import { Static, Type } from '@sinclair/typebox';
import envSchema from 'env-schema';

const schema = Type.Object({
  /** Hostname of the API server */
  API_HOST: Type.String({ default: '0.0.0.0' }),
  /** Port in which to serve the API */
  API_PORT: Type.Number({ default: 3000, minimum: 0, maximum: 65535 }),

  /** Scheme of the Stacks Core RPC server */
  STACKS_CORE_RPC_SCHEME: Type.String({ default: 'http' }),
  /** Hostname of the Stacks Core RPC server */
  STACKS_CORE_RPC_HOST: Type.String(),
  /** Port for the Stacks Core RPC server */
  STACKS_CORE_RPC_PORT: Type.Integer({ default: 20443, minimum: 0, maximum: 65535 }),
  /** Auth token for the Stacks Core RPC server */
  STACKS_CORE_RPC_AUTH_TOKEN: Type.String(),

  /** Size of the token metadata cache. Defaults to 1000. */
  TOKEN_METADATA_CACHE_SIZE: Type.Integer({ default: 1000, minimum: 0 }),
  /** TTL of the token metadata cache in milliseconds. Defaults to 24 hours. */
  TOKEN_METADATA_CACHE_TTL_MS: Type.Integer({ default: 1000 * 60 * 60 * 24, minimum: 0 }),
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
