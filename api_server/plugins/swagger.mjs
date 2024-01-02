import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import fastifyPlugin from 'fastify-plugin';
import S from 'fluent-json-schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version, author, email } = JSON.parse(readFileSync(join(__dirname, '../package.json')));

export default fastifyPlugin(async function (fastify, opts) {
  fastify.decorate('schemaNotEmpty', S.string().minLength(1).pattern(/^(?!\s+$)/));
  fastify.decorate('clientErrResponse', (schemaObj) => (
    (schemaObj || S.object().description('Invalid request'))
      .prop('message', S.string())
  ));
  fastify.decorate('svrErrResponse', S.object()
    .description('Internal server error')
    .prop('data', S.object().additionalProperties(true).default(null))
    .prop('message', S.string().default('Internal server error'))
  );

  await fastify.register(import('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'An API server for AWS S3 manipulations',
        description: 'The documentation about AWS S3 operations and related services',
        version,
        contact: { name: author, email },
      },
      host: 'localhost:3000',
      schemes: ['http'],
      tags: [
        { name: 'S3 objects', description: 'API for S3 object manipulation' },
        { name: 'S3 history', description: 'API for S3 object manipulation history' },
        { name: 'Users', description: 'API for authorization' },
      ],
      securityDefinitions: {
        jwt: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
    },
    exposeRoute: process.env.NODE_ENV === 'dev',
  });

  if (process.env.NODE_ENV === 'dev') {
    await fastify.register(import('@fastify/swagger-ui'), {
      routePrefix: '/doc',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: false,
      transformStaticCSP: (header) => header,
    });
  }
}, { name: 'swaggerConfig' });