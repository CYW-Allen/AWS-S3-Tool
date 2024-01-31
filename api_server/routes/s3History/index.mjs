import S from 'fluent-json-schema';

export default async function (fastify, _opts) {
  const historyProps = ['action', 'createdTimeNum', 'editor', 'objKey'];
  const s3Operations = ['create', 'upload', 'modify', 'switch', 'delete', 'restore'];

  const respInvalidReq = fastify.clientErrResponse();
  const respUnpermitReq = fastify.clientErrResponse(
    S.object().description('Insufficient permissions'),
  );

  const optsListHistory = {
    schema: {
      summary: 'List all history',
      description: 'List all s3 objects\' operations history in specific bucket',
      tags: ['S3 history'],
      security: [{ jwt: [] }],
      querystring: S.object().prop('bucket', fastify.schemaNotEmpty),
      response: {
        200: S.object()
          .description('Success to get history of the bucket')
          .prop('data', S.array().items(S.object().additionalProperties(true))),
        400: respInvalidReq,
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsGetHistoryByCondition = {
    schema: {
      summary: 'List specific history',
      description: 'List history under the specific conditions',
      tags: ['S3 history'],
      security: [{ jwt: [] }],
      querystring: S.object().prop('bucket', fastify.schemaNotEmpty),
      body: S.object()
        .prop('obj', S.string().enum(historyProps).required())
        .prop('filters', S.object()
          .prop('action', S.string().enum(s3Operations))
          .prop('editor', fastify.schemaNotEmpty)
          .prop('objKey', fastify.schemaNotEmpty)
        )
        .ifThenElse(
          S.object().prop('obj', S.string().const('action')),
          S.object().prop('objVal', S.string().enum(s3Operations).required()),
          S.object().prop('objVal', fastify.schemaNotEmpty.required())
        ),
      response: {
        200: S.object()
          .description('Success to get specific history of the bucket')
          .prop('data', S.array().items(S.object().additionalProperties(true))),
        400: respInvalidReq,
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      }
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsAddHistory = {
    schema: {
      summary: 'Add new history',
      description: 'Manual add new history of the object',
      tags: ['S3 history'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      body: S.object()
        .prop('objKey', fastify.schemaNotEmpty.required())
        .prop('action', S.string().enum(s3Operations).required())
        .prop('editor', fastify.schemaNotEmpty.required())
        .prop('createdTimeNum', fastify.schemaNotEmpty.required()),
      response: {
        200: S.object()
          .description('Success to add new object history')
          .prop('data', S.null()),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: fastify.clientErrResponse(S.object().description('Invaild editor')),
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission]
  };

  const optsDeleteHistory = {
    schema: {
      summary: 'Delete history',
      description: 'Delete the history under the specific condition',
      tags: ['S3 history'],
      security: [{ jwt: [] }],
      body: S.object()
        .prop('obj', S.string().enum(['bucket', 'recId', ...historyProps]).required())
        .ifThenElse(
          S.object().prop('obj', S.string().const('action')),
          S.object().prop('objVal', S.string().enum(s3Operations).required()),
          S.object().prop('objVal', fastify.schemaNotEmpty.required())
        ),
      response: {
        200: S.object()
          .description('Finish to delete history')
          .prop('failure', S.array().items(S.string())),
        400: respInvalidReq,
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      }
    },
    onRequest: [fastify.verifyToken, fastify.checkAdmin],
  };

  fastify.get('/', optsListHistory, fastify.listHistory);
  fastify.post('/', optsGetHistoryByCondition, fastify.getHistoryByCondition);
  fastify.put('/:bucket', optsAddHistory, fastify.addHistory);
  fastify.delete('/', optsDeleteHistory, fastify.deleteHistory);
};