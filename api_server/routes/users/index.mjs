import S from 'fluent-json-schema';

export default async function (fastify, _opts) {
  const schemaUsername = S.string().pattern(/^[a-zA-Z0-9]{1,10}$/).required();
  const schemaPassword = S.string().pattern(/^[a-zA-Z0-9]{5,10}$/).required();
  const respUnpermitReq = fastify.clientErrResponse(
    S.object().description('Request forbidden')
  );
  const respUserNotExist = fastify.clientErrResponse(
    S.object().description('Non existent user')
  );

  const optsSignup = {
    schema: {
      summary: 'Become an authorized user',
      description: 'Get permission for AWS S3 manipulation',
      tags: ['Users'],
      body: S.object()
        .prop('username', schemaUsername)
        .prop('password', schemaPassword),
      response: {
        200: S.object()
          .description('Success to sign up')
          .prop('token', S.string()),
        400: fastify.clientErrResponse(),
        409: fastify.clientErrResponse(S.object().description('Request conflict')),
        500: fastify.svrErrResponse,
      },
    },
  };

  const optsSignin = {
    schema: {
      summary: 'Get permission',
      description: 'Get permission for AWS S3 manipulation',
      tags: ['Users'],
      body: S.object()
        .prop('username', schemaUsername)
        .prop('password', schemaPassword),
      response: {
        200: S.object()
          .description('Success to sign in')
          .prop('token', S.string()),
        400: fastify.clientErrResponse(),
        500: fastify.svrErrResponse,
      },
    },
  };

  const optsEditPermission = {
    schema: {
      summary: 'Edit permission',
      description: 'Edit permission (bucketScope, isAdmin) for specific user',
      tags: ['Users'],
      security: [{ jwt: [] }],
      params: S.object().prop('user', schemaUsername),
      body: S.object()
        .prop('scope', S.array().items(S.string()).required())
        .prop('isAdmin', S.boolean().enum([true, false]).required()),
      response: {
        200: S.object()
          .description('Success to update permission')
          .prop('message', S.string()),
        400: fastify.clientErrResponse(),
        403: respUnpermitReq,
        404: respUserNotExist,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkAdmin],
  };

  const optsDeleteUser = {
    schema: {
      summary: 'Revoke permission',
      descriptionL: 'Remove user from auth table',
      tags: ['Users'],
      security: [{ jwt: [] }],
      params: S.object().prop('user', schemaUsername),
      response: {
        200: S.object()
          .description('Success to revoke the permission of the user')
          .prop('message', S.string()),
        400: fastify.clientErrResponse(),
        403: respUnpermitReq,
        404: respUserNotExist,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkAdmin],
  };

  const optsListUsers = {
    schema: {
      summary: 'List users',
      description: 'List all users in auth table',
      tags: ['Users'],
      security: [{ jwt: [] }],
      response: {
        200: S.object()
          .description('Success to get all users')
          .prop('data', S.array().items(S.object().additionalProperties(true))),
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkAdmin],
  };

  fastify.post('/signup', optsSignup, fastify.signup);
  fastify.post('/signin', optsSignin, fastify.signin);
  fastify.patch('/:user/permission', optsEditPermission, fastify.editPermission);
  fastify.delete('/:user', optsDeleteUser, fastify.deleteUser);
  fastify.get('/', optsListUsers, fastify.listUsers);
}