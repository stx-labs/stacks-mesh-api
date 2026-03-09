import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import FastifySwagger, { SwaggerOptions } from '@fastify/swagger';
import { readFileSync, writeFileSync } from 'fs';
import { MeshApiRoutes } from './api/routes/index.js';
import { ApiConfig } from './api/index.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);

export const OpenApiSchemaOptions: SwaggerOptions = {
  openapi: {
    info: {
      title: 'Stacks Mesh API',
      description: 'A Mesh API (formerly Rosetta API) implementation for the Stacks blockchain',
      version,
    },
    externalDocs: {
      url: 'https://github.com/stx-labs/stacks-mesh-api',
      description: 'Source Repository',
    },
    tags: [
      {
        name: 'Network',
        description: 'Network endpoints',
      },
      {
        name: 'Block',
        description: 'Block endpoints',
      },
      {
        name: 'Account',
        description: 'Account endpoints',
      },
      {
        name: 'Mempool',
        description: 'Mempool endpoints',
      },
      {
        name: 'Construction',
        description: 'Construction endpoints',
      },
      {
        name: 'Call',
        description: 'Call endpoints',
      },
    ],
  },
};

/**
 * Generates `openapi.yaml` based on current Swagger definitions.
 */
async function generateOpenApiFiles() {
  const fastify = Fastify({
    trustProxy: true,
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(FastifySwagger, OpenApiSchemaOptions);
  await fastify.register(MeshApiRoutes, undefined as unknown as ApiConfig);
  await fastify.ready();
  writeFileSync('./openapi.yaml', fastify.swagger({ yaml: true }));
  await fastify.close();
}

void generateOpenApiFiles();
