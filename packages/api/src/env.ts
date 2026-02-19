import { Static, Type } from '@sinclair/typebox';
import envSchema from 'env-schema';

const schema = Type.Object({
  /** Hostname of the API server */
  API_HOST: Type.String({ default: '0.0.0.0' }),
  /** Port in which to serve the API */
  API_PORT: Type.Number({ default: 3000, minimum: 0, maximum: 65535 }),

  /** Hostname of the Stacks Core RPC server */
  STACKS_CORE_RPC_HOST: Type.String(),
  /** Port for the Stacks Core RPC server */
  STACKS_CORE_RPC_PORT: Type.Integer({ default: 20443, minimum: 0, maximum: 65535 }),
  /** Auth token for the Stacks Core RPC server */
  STACKS_CORE_RPC_AUTH_TOKEN: Type.String(),
  /** Timeout for the Stacks Core RPC server in milliseconds */
  STACKS_CORE_RPC_TIMEOUT_MS: Type.Integer({ default: 10000, minimum: 0 }),
});
type Env = Static<typeof schema>;

export const ENV = envSchema<Env>({
  schema: schema,
  dotenv: true,
});
