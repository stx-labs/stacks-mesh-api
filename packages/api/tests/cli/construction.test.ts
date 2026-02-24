import * as assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { FastifyInstance } from 'fastify';
import {
  setupDockerServices,
  teardownDockerServices,
  buildTestServer,
  ensureMeshCli,
  API_PORT,
  type DockerResources,
} from './helpers.js';

describe('Construction API', () => {
  let fastify: FastifyInstance;
  let dockerResources: DockerResources;
  let meshCliBin: string;

  before(async () => {
    [dockerResources, meshCliBin] = await Promise.all([
      setupDockerServices(),
      ensureMeshCli(),
    ]);
    fastify = await buildTestServer();
    await fastify.listen({ host: '0.0.0.0', port: API_PORT });
  }, { timeout: 120_000 });

  after(async () => {
    await fastify?.close();
    await teardownDockerServices(dockerResources);
  }, { timeout: 30_000 });

  test('placeholder — server is running', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/network/list',
      payload: {},
    });
    assert.strictEqual(res.statusCode, 200);
  });
});
