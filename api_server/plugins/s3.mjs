import fastifyPlugin from "fastify-plugin";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { lookup } from 'mime-types';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import 'dayjs/locale/zh-tw.js';

export default fastifyPlugin(async function (fastify, opts) {
  dayjs.extend(localizedFormat);
  dayjs.locale('zh-tw');

  const credObj = {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  };
  const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    ...(process.env.NODE_ENV === 'dev' && credObj),
  });
  const cloudfrontClient = new CloudFrontClient({
    region: process.env.AWS_CLOUDFRONT_REGION,
    ...(process.env.NODE_ENV === 'dev' && credObj),
  });

  const RESERVED_KEY = process.env.RESERVED_KEY.split(',');

  const getTimeStr = (time) => dayjs(time).format('LL(dd) HH:mm');

  function getFileSizeString(fileSize) {
    const fsNum = Number(fileSize);

    if (isNaN(fsNum)) throw new Error('Invalid file size value');
    if (fsNum < 1000) return '1KB';
    if (fsNum < 1000000) return `${Math.round(fsNum * 0.001)}KB`;
    return `${Math.round(fsNum * 0.000001)}MB`;
  }

  function structureObjs(objs) {
    const objStructure = {};

    if (objs instanceof Array) {
      objs.forEach((obj) => {
        const dirKeys = obj.Key.split('/').filter((k) => k !== '');

        if (RESERVED_KEY.includes(dirKeys[0])) return;

        dirKeys.forEach((key, index) => {
          const isFile = (index === dirKeys.length - 1) && obj.Key[obj.Key.length - 1] !== '/';
          const objDir = index === 0 ? '/' : `/${dirKeys.slice(0, index).join('/')}`;
          const objPath = `${objDir === '/' ? '' : objDir}/${key}`;

          (objStructure[objDir] ??= {})[objPath] = {
            name: key,
            isFile,
            lastModified: getTimeStr(obj.LastModified),
            lastTime: obj.LastModified.getTime(),
            ...(isFile && {
              size: obj.Size,
              sizeStr: getFileSizeString(obj.Size),
            }),
          };
        });
      });
    }
    return objStructure;
  }

  async function listAllObjs(req) {
    const Bucket = req.params.bucket;
    const user = req.user.username;
    const result = [];
    let st = Date.now();
    let times = 0;

    try {
      const s3Cmd = new ListObjectsV2Command({ Bucket });

      do {
        const resp = await s3Client.send(s3Cmd);

        for (let i = 0; i < resp.Contents?.length || 0; i++) result.push(resp.Contents[i]);
        s3Cmd.input.ContinuationToken = resp.NextContinuationToken;
        times++;
      } while (s3Cmd.input.ContinuationToken);

      fastify.logStat('info', `${user}->listAllObjs`, `Time cost: ${Date.now() - st}ms; loops: ${times}`);
      return { data: structureObjs(result) };
    } catch (err) {
      fastify.logStat('error', `${user}->listAllObjs`, `${err.name}: ${err.message}`);
      if (err.name === 'NoSuchBucket') return undefined;
      return null;
    }
  }

  async function downloadFiles(req) {
    const Bucket = req.params.bucket;
    const reqList = req.query.reqList.split(',');
    const fileUrls = [];
    const failedKeys = [];
    const results = await Promise.allSettled(reqList.map((Key) => getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket,
        Key,
        ResponseContentDisposition: `attachment; filename=${encodeURI(Key.split('/').slice(-1)[0])}`,
      }),
      { expiresIn: 3000 },
    )));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') fileUrls.push(result.value);
      else {
        const failKey = reqList[index];

        failedKeys.push(failKey);
        fastify.logStat('error', `${req.user.username}->downloadFiles`, `${Bucket}/${failKey} fail - ${result.reason}`);
      }
    });
    return { data: { fileUrls, failedKeys } };
  }

  async function getObjVersion(req) {
    try {
      const objKey = req.query.objKey;
      const s3Cmd = new ListObjectVersionsCommand({
        Bucket: req.params.bucket,
        Prefix: objKey,
      });
      const objVerInfos = [];

      do {
        const resp = await s3Client.send(s3Cmd);
        const infos = resp.Versions
          ?.filter((ver) => ver.Key === objKey && !ver.IsLatest)
          ?.map((ver) => ({
            createdAt: ver.LastModified,
            size: getFileSizeString(ver.Size),
            verId: ver.VersionId,
          })) || [];

        for (let i = 0; i < infos.length; i++) objVerInfos.push(infos[i]);
        s3Cmd.input.VersionIdMarker = resp.NextVersionIdMarker;
      } while (s3Cmd.input.VersionIdMarker);

      return { data: { objVerInfos } };
    } catch (err) {
      fastify.logStat('error', `${req.user.username}->getObjVersion`, `${err.name}: ${err.message}`);
      if (err.name === 'NoSuchBucket') return undefined;
      return null;
    }
  }

  async function createFolder(req) {
    const Bucket = req.params.bucket;
    const user = req.user.username;
    const Key = req.body.objKeys[0];

    try {
      await s3Client.send(new HeadObjectCommand({ Bucket, Key }));
      fastify.logStat('info', `${user}->createFolder`, `The folder (${Bucket}:${Key}) has already existed`);
      return null;
    } catch (err) {
      if (err.name === 'NotFound') {
        try {
          await s3Client.send(new PutObjectCommand({ Bucket, Key, ContentLength: 0 }));
          fastify.logStat('info', `${user}->createFolder`, `${Bucket}:${Key} success`);
          await fastify.recordOper(Bucket, Key, 'create', user);
          return true;
        } catch (e) {
          fastify.logStat('error', `${user}->createFolder`, `${e.name}: ${e.message}`);
          if (e.name === 'NoSuchBucket') return undefined;
          return null;
        }
      }
      fastify.logStat('error', `${user}->createFolder`, `${err.name}: ${err.message}`);
      return null;
    }
  }

  async function getUploadUrls(req) {
    const bucket = req.params.bucket;
    const user = req.user.username;
    const { objKeys, isPublic } = req.body;

    const success = [];
    const failure = [];
    const results = await Promise.allSettled(
      objKeys?.map((Key) => createPresignedPost(
        s3Client,
        {
          Bucket: bucket,
          Key,
          Conditions: [{ bucket }, ...(isPublic && [{ acl: 'public-read' }])],
          Fields: {
            ...(isPublic && { acl: 'public-read' }),
            'Content-Type': lookup(Key) || 'application/octet-stream',
          },
          Expires: 3000,
        },
      )) || []
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') success.push(result.value);
      else {
        const failKey = objKeys[index];
        failure.push(failKey);
        fastify.logStat('error', `${user}->getUploadUrls`, `${failKey} fail - ${result.reason}`);
      }
    });
    return { data: { success, failure } };
  }

  fastify.decorate('listBuckets', async function (req, reply) {
    try {
      return reply.send({
        data: (await s3Client.send(new ListBucketsCommand({})))
          ?.Buckets?.map((bucket) => bucket.Name) || [],
      });
    } catch (err) {
      fastify.logStat('error', `${req.user.username}->listBuckets`, `${err.name}: ${err.message}`);
      return reply.code(500).send();
    }
  });

  fastify.decorate('getBucketsInfo', async function (req, reply) {
    try {
      const output = {};
      const buckets = req.user.isAdmin
        ? (await s3Client.send(new ListBucketsCommand({})))
          ?.Buckets?.map((bucket) => bucket.Name) || []
        : req.user.bucketScope;

      if (!buckets.length) return reply.send({ data: {} });

      buckets.forEach((bucket) => {
        output[bucket] = null;
      });

      const listDistributionsCmd = new ListDistributionsCommand({});
      const distributions = [];
      const s3BucketPattern = /(.+)\.s3-website-ap-northeast-1\.amazonaws\.com/;

      do {
        const resp = await cloudfrontClient.send(listDistributionsCmd);
        const distribList = resp?.DistributionList?.Items;

        if (distribList?.length) {
          distribList.forEach((distrib) => distributions.push(distrib));
        }
        listDistributionsCmd.input.Marker = resp?.DistributionList?.NextMarker;
      } while (listDistributionsCmd.input.Marker);

      distributions.forEach((distrib) => {
        const originNameList = distrib.Origins.Items.map((i) => {
          const match = i.DomainName.match(s3BucketPattern);
          return match ? match[1] : null;
        });

        for (let i = 0; i < originNameList.length; i++) {
          if (buckets.includes(originNameList[i])) {
            output[originNameList[i]] = {
              cdnID: distrib.Id,
              domain: distrib.Aliases.Items[i],
            };
            break;
          }
        }
      });
      return reply.send({ data: output });
    } catch (err) {
      fastify.logStat('error', `${req.user.username}->listBuckets`, `${err.name}: ${err.message}`);
      return reply.code(500).send();
    }
  });

  fastify.decorate('getObjects', async function (req, reply) {
    let result;

    switch (req.query.type) {
      case 'structure':
        result = await listAllObjs(req);
        if (result) return reply.send(result);
        if (result === undefined) return reply.code(404).send({ message: 'The specified bucket does not exist' });
        return reply.code(500).send();
      case 'file':
        return reply.send(await downloadFiles(req, reply));
      case 'versions':
        result = await getObjVersion(req);
        if (result) return reply.send(result);
        if (result === undefined) return reply.code(404).send({ message: 'The specified bucket does not exist' });
        return reply.code(500).send();
      default:
        return reply.code(400).send();
    }
  });

  fastify.decorate('createObjects', async function (req, reply) {
    if (req.query.type === 'folder') {
      const isSuccess = await createFolder(req);

      if (isSuccess) return reply.code(204).send();
      if (isSuccess === undefined) return reply.code(404).send({ message: 'The specified bucket does not exist' });
      return reply.code(500).send({ message: 'Fail to create folder' });
    }
    return reply.send(await getUploadUrls(req));
  });

  fastify.decorate('deleteObjects', async function (req, reply) {
    const Bucket = req.params.bucket;
    const user = req.user.username;

    try {
      const result = await s3Client.send(new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: req.body },
      }));
      const success = result?.Deleted?.map((delInfo) => delInfo.Key) || [];
      const failure = [];

      result?.Errors?.forEach((err) => {
        failure.push(err.Key);
        fastify.logStat('error', `${user}->deleteObjects`, `Fail to delete ${err.Key}: ${err.Message}`);
      });

      await Promise.allSettled(success.map((key) => fastify.recordOper(Bucket, key, 'delete', user)));
      return reply.send({ data: { success, failure } });
    } catch (err) {
      fastify.logStat('error', `${user}->deleteObjects`, `${err.name}: ${err.message}`);
      if (err.name === 'NoSuchBucket') return reply.code(404).send({ message: err.message });
      return reply.code(500).send();
    }
  });

  fastify.decorate('modifyObjInfo', async function (req, reply) {
    const Bucket = req.params.bucket;
    const user = req.user.username;
    const { items, isPublic } = req.body;

    const failure = [];
    const successCopy = [];
    const copyResults = await Promise.allSettled(
      items.map((item) => s3Client.send(new CopyObjectCommand({
        Bucket,
        CopySource: encodeURI(`${Bucket}/${item.oriKey}`),
        Key: item.newKey,
        ...(isPublic && { ACL: 'public-read' }),
      })))
    );

    copyResults.forEach((result, index) => {
      if (result.status === 'fulfilled') successCopy.push(items[index].oriKey);
      else {
        fastify.logStat('error', `${user}->modifyObjInfo`, `Fail to copy ${items[index].oriKey}: ${result.reason}`);
        failure.push(items[index].oriKey);
      }
    });

    try {
      const deleteResult = await s3Client.send(new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: successCopy.map((Key) => ({ Key })) }
      }));
      const success = deleteResult?.Deleted?.map((delInfo) => delInfo.Key) || [];

      deleteResult?.Errors?.forEach((err) => {
        failure.push(err.Key);
        fastify.logStat('error', `${user}->modifyObjInfo`, `Fail to delete ${err.Key}: ${err.Message}`);
      });
      await Promise.allSettled(success.map((key) => fastify.recordOper(Bucket, key, 'modify', user)));
      return reply.send({ data: { success, failure } });
    } catch (err) {
      fastify.logStat('error', `${user}->modifyObjInfo`, `${err.name}: ${err.message}`);
      if (err.name === 'NoSuchBucket') return reply.code(404).send({ message: err.message });
      return reply.code(500).send();
    }
  });

  fastify.decorate('changeObjVer', async function (req, reply) {
    const Bucket = req.params.bucket;
    const { verId, key, isPublic } = req.query;
    const user = req.user.username;

    try {
      await s3Client.send(new CopyObjectCommand({
        Bucket,
        CopySource: encodeURI(`${Bucket}/${key}?versionId=${verId}`),
        Key: key,
        ...(Boolean(isPublic) && { ACL: 'public-read' }),
      }));
      await s3Client.send(new DeleteObjectCommand({
        Bucket,
        Key: key,
        VersionId: verId,
      }));
      await fastify.recordOper(Bucket, key, 'switch', user);
      fastify.logStat('info', `${user}->changeObjVer`, `Success to switch the version of the object (${key})`);
      return reply.code(204).send();
    } catch (err) {
      fastify.logStat('error', `${user}->changeObjVer`, `${err.name}: ${err.message}`);
      if (err.name === 'NoSuchBucket' || err.name === 'NoSuchVersion') {
        return reply.code(404).send({ message: err.message });
      }
      return reply.code(500).send();
    }
  });

  fastify.decorate('restoreDelObj', async function (req, reply) {
    const Bucket = req.params.bucket;
    const user = req.user.username;
    const { reqList } = req.body;

    const failure = [];
    const curDelList = [];

    try {
      const getVersionResults = await Promise.allSettled(
        reqList.map((objKey) => s3Client.send(
          new ListObjectVersionsCommand({ Bucket, Prefix: objKey })
        ))
      );

      getVersionResults.forEach((result, index) => {
        const curObjKey = reqList[index];

        if (result.status === 'fulfilled') {
          const delVersions = result.value.DeleteMarkers;

          if (!result.value.Versions) {
            failure.push(curObjKey);
            fastify.logStat('error', `${user}->restoreDelObj`, `The object: ${curObjKey} has never existed`);
          } else if (!delVersions || !delVersions[0].IsLatest) {
            failure.push(curObjKey);
            fastify.logStat('error', `${user}->restoreDelObj`, `The object: ${curObjKey} is still alive`);
          } else {
            curDelList.push({ Key: curObjKey, VersionId: delVersions[0].VersionId });
          }
        } else {
          failure.push(curObjKey);
          fastify.logStat('error', `${user}->restoreDelObj`, `Fail to get version of ${curObjKey}: ${result.reason}`);
        }
      });

      const deleteResult = curDelList.length
        ? await s3Client.send(new DeleteObjectsCommand({
          Bucket, Delete: { Objects: curDelList }
        }))
        : {};
      const success = deleteResult?.Deleted?.map((delInfo) => delInfo.Key) || [];

      deleteResult?.Errors?.forEach((err) => {
        failure.push(err.Key);
        fastify.logStat('error', `${user}->restoreDelObj`, `Fail to delete ${err.Key}: ${err.Message}`);
      });

      await Promise.allSettled(success.map((key) => fastify.recordOper(Bucket, key, 'restore', user)));
      return reply.send({ data: { success, failure } });
    } catch (err) {
      fastify.logStat('error', `${user}->restoreDelObj`, `${err.name}: ${err.message}`);
      return reply.code(500).send();
    }
  });

  fastify.decorate('refreshCDN', async function (req, reply) {
    const user = req.user.username;
    const { DistributionId, Items } = req.body;

    try {
      await cloudfrontClient.send(new CreateInvalidationCommand({
        DistributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: { Quantity: Items.length, Items },
        },
      }));
      await fastify.logStat('info', `${user}->refreshCDN`, `Success to refresh cdn (id: ${DistributionId})`);
      return reply.code(204).send();
    } catch (err) {
      fastify.logStat('error', `${user}->refreshCDN`, `${err.name}: ${err.message}`);
      return reply.code(500).send();
    }
  });

}, {
  name: 's3Handler',
  dependencies: ['s3Recorder', 'logHandler'],
});