import S from 'fluent-json-schema';

export default async function (fastify, _opts) {
  const respInvalidReq = fastify.clientErrResponse();
  const respUnpermitReq = fastify.clientErrResponse(
    S.object().description('Insufficient permissions'),
  );

  const optsListBuckets = {
    schema: {
      summary: 'List all S3 buckets',
      description: 'Get all S3 buckets',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      response: {
        200: S.object()
          .description('Success to get all buckets')
          .prop('data', S.array().items(S.string())),
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkAdmin],
  };

  const optsGetBucketsInfo = {
    schema: {
      summary: 'Get info of S3 buckets',
      description: 'Get informations about specific S3 buckets',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      response: {
        200: S.object()
          .description('Success to get informations of buckets')
          .prop('data', S.object().additionalProperties(true)),
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken],
  }

  const optsGetObjs = {
    schema: {
      summary: 'Get S3 objects',
      description: 'Get objects within the specific bucket',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      querystring: S.object()
        .allOf([
          S.object().prop('type', S.string().enum(['structure', 'file', 'versions']).required()),
          S.ifThen(
            S.object().prop('type', S.string().const('file')),
            S.object().prop('reqList', fastify.schemaNotEmpty.required())
          ),
          S.ifThen(
            S.object().prop('type', S.string().const('versions')),
            S.object().prop('objKey', fastify.schemaNotEmpty.required())
          ),
        ]),
      response: {
        200: S.object()
          .description('Success to get objects')
          .prop('data', S.object().additionalProperties(true)),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: respInvalidReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsCreateObjs = {
    schema: {
      summary: 'Create new object',
      description: 'Create new folder or upload files to specific bucket',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      querystring: S.object().prop('type', S.string().enum(['folder', 'file']).required()),
      body: S.object()
        .prop('objKeys', S.array().items(fastify.schemaNotEmpty).minItems(1).required())
        .prop('isPublic', S.boolean()),
      response: {
        200: S.object()
          .description('Success to create object')
          .prop('data', S.object()
            .prop('objInfos', S.array().items(S.object().additionalProperties(true)))
            .prop('failedKeys', S.array().items(S.string()))
          ),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: respInvalidReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsDeleteObjs = {
    schema: {
      summary: 'Delete objects',
      description: 'Delete files/folders within specific bucket',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      body: S.array().items(S.object().prop('Key', fastify.schemaNotEmpty.required())).minItems(1),
      response: {
        200: S.object()
          .description('Success to delete specific objects in the bucket')
          .prop('data', S.object()
            .prop('success', S.array().items(S.string()))
            .prop('failure', S.array().items(S.string()))
          ),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: respInvalidReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsModifyObjs = {
    schema: {
      summary: 'Update objects',
      description: 'Modify objects\' name/directory in the bucket',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      body: S.object()
        .prop('items', S.array()
          .items(S.object()
            .prop('oriKey', fastify.schemaNotEmpty.required())
            .prop('newKey', fastify.schemaNotEmpty.required())
          ).minItems(1).required())
        .prop('isPublic', S.boolean().required()),
      response: {
        200: S.object()
          .description('Success to modify objects')
          .prop('data', S.object()
            .prop('success', S.array().items(S.string()))
            .prop('failure', S.array().items(S.string()))),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: respInvalidReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsChangeVersion = {
    schema: {
      summary: 'Update object',
      description: 'Switch the verison of the object',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      querystring: S.object()
        .prop('verId', fastify.schemaNotEmpty.required())
        .prop('key', fastify.schemaNotEmpty.required())
        .prop('isPublic', S.boolean().enum([true, false])),
      response: {
        200: S.object()
          .description('Success to change object\'s version')
          .prop('data', S.null()),
        400: respInvalidReq,
        403: respUnpermitReq,
        404: respInvalidReq,
        500: fastify.svrErrResponse,
      }
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsRestoreDelObj = {
    schema: {
      summary: 'Restore deleted objects',
      description: 'Restore deleted objects',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      params: S.object().prop('bucket', fastify.schemaNotEmpty.required()),
      body: S.object().prop('reqList', S.array().items(S.string()).required()),
      response: {
        200: S.object()
          .description('Finish to process the restore request')
          .prop('data', S.object()
            .prop('success', S.array().items(S.string()))
            .prop('failure', S.array().items(S.object()
              .prop('key', S.string())
              .prop('reason', S.string())
            ))
          ),
        400: respInvalidReq,
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      },
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  const optsRefreshCDN = {
    schema: {
      summary: 'Refresh cloudfront',
      description: 'Refresh the distributions of the bucket',
      tags: ['S3 objects'],
      security: [{ jwt: [] }],
      body: S.object()
        .prop('DistributionId', fastify.schemaNotEmpty.required())
        .prop('Items', S.array().items(S.string()).minItems(1).required()),
      response: {
        200: S.object()
          .description('Success to refresh the distributions')
          .prop('data', S.null()),
        400: respInvalidReq,
        403: respUnpermitReq,
        500: fastify.svrErrResponse,
      }
    },
    onRequest: [fastify.verifyToken, fastify.checkPermission],
  };

  fastify.get('/:bucket/objects', optsGetObjs, fastify.getObjects);
  fastify.put('/:bucket/objects', optsCreateObjs, fastify.createObjects);
  fastify.delete('/:bucket/objects', optsDeleteObjs, fastify.deleteObjects);
  fastify.patch('/:bucket/objects/infos', optsModifyObjs, fastify.modifyObjInfo);
  fastify.patch('/:bucket/object/version', optsChangeVersion, fastify.changeObjVer);
  fastify.patch('/:bucket/objects/existence', optsRestoreDelObj, fastify.restoreDelObj);

  fastify.get('/infos', optsGetBucketsInfo, fastify.getBucketsInfo);
  fastify.get('/', optsListBuckets, fastify.listBuckets)

  fastify.patch('/distributions', optsRefreshCDN, fastify.refreshCDN);

};