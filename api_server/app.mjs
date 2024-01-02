import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCors from '@fastify/cors';
import autoload from '@fastify/autoload';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const options = {};

export default async function init(fastify, opts) {
  fastify.register(fastifyCors, {
    origin: '*',
    method: '*',
  });

  fastify.register(autoload, {
    dir: join(__dirname, 'plugins'),
    options: { ...opts },
  });

  fastify.register(autoload, {
    dir: join(__dirname, 'routes'),
    options: { ...opts },
  })
}