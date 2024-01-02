export default async function (fastify, _opts) {
  fastify.get('/', async function (req, reply) {
    reply.send('users route');
  });
};