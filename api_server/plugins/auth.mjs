import fastifyPlugin from "fastify-plugin";
import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

export default fastifyPlugin(async function (fastify, opts) {
  await fastify.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET,
    sign: { algorithm: 'HS256', expiresIn: '7d' },
    verify: { maxAge: '7d' },
  });

  fastify.decorate('signup', async function (req, reply) {
    const { username, password } = req.body;
    const curTime = dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss');
    const bucketScope = new Set([process.env.DEFAULT_SCOPE]);
    const isAdmin = false;

    try {
      await fastify.dbClient.send(new PutCommand({
        TableName: fastify.userTable,
        Item: {
          username,
          password: bcrypt.hashSync(password, 10),
          createdAt: curTime,
          lastLogin: curTime,
          bucketScope,
          isAdmin,
        },
        ConditionExpression: 'attribute_not_exists(username)',
      }));
      fastify.logStat('info', 'signup', `The user (${username}) is success to sign up`);
      return reply.send({ token: fastify.jwt.sign({ username, bucketScope: [...bucketScope], isAdmin }) })
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        fastify.logStat('info', 'signup', `The user (${username}) is success to sign up`);
        return reply.code(409).send({ message: `This name (${username}) has already been used` });
      } else {
        fastify.logStat('error', 'signup', err);
        return reply.code(500).send();
      }
    }
  });

  fastify.decorate('signin', async function (req, reply) {
    const { username, password } = req.body;

    try {
      const result = (await fastify.dbClient.send(new UpdateCommand({
        TableName: fastify.userTable,
        Key: { username },
        UpdateExpression: 'SET lastLogin = :v_lastLogin',
        ConditionExpression: 'attribute_exists(username)',
        ExpressionAttributeValues: {
          ':v_lastLogin': dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss'),
        },
        ReturnValues: 'ALL_NEW',
      }))).Attributes;

      if (!result || !bcrypt.compareSync(password, result.password)) {
        fastify.logStat('info', 'signin', `Invalid password for ${username}`);
        return reply.code(400).send({ message: 'Invalid user infos' });
      } else {
        fastify.logStat('info', 'signin', `The user (${username}) is success to sign in`);
        return reply.send({
          token: fastify.jwt.sign({
            username,
            bucketScope: [...result.bucketScope],
            isAdmin: result.isAdmin,
          }),
        });
      }
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        fastify.logStat('info', 'signin', `The user (${username}) doesn\'t exist`);
        return reply.code(400).send({ message: 'Invalid user infos' });
      } else {
        fastify.logStat('error', 'signin', err);
        return reply.code(500).send();
      }
    }
  });

  fastify.decorate('verifyToken', async function (req, reply) {
    try {
      await req.jwtVerify();
      return true;
    } catch (err) {
      fastify.logStat('info', 'verifyToken', err);
      return reply.code(403).send({ message: 'You have no permission to do this' });
    }
  });

  fastify.decorate('checkPermission', async function (req, reply) {
    const { isAdmin, bucketScope, username } = req.user;
    const bucket = req.params.bucket;

    if (!isAdmin && !bucketScope.includes(bucket)) {
      fastify.logStat('info', 'checkPermission', `The user (${username}) have no permission to the bucket ${bucket}`);
      return reply.code(403).send({ message: 'Request forbidden' });
    }
    return true;
  });

  fastify.decorate('checkAdmin', async function (req, reply) {
    if (!req.user.isAdmin) {
      fastify.logStat('info', 'checkAdmin', `The user (${req.user.username}) is not an administrator`);
      return reply.code(403).send({ message: 'You have no permission to do this' });
    }
    return true;
  });

  fastify.decorate('editScope', async function (req, reply) {
    const username = req.params.user;
    const { bucket, action } = req.query;

    try {
      await fastify.dbClient.send(new UpdateCommand({
        TableName: fastify.userTable,
        Key: { username },
        UpdateExpression: `${action} bucketScope :v_bucket`,
        ConditionExpression: 'attribute_exists(username)',
        ExpressionAttributeValues: {
          ':v_bucket': new Set([bucket]),
        },
      }));
      fastify.logStat('info', 'editScope', `The scope of the user (${username}) has already been update. (${action} ${bucket})`);
      return reply.send({ message: 'Success to edit scope' });
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        fastify.logStat('info', 'editScope', `The user (${username}) doesn\'t exist`);
        return reply.code(404).send({ message: 'The user doesn\'t exist' });
      } else {
        fastify.logStat('error', 'editScope', err);
        return reply.code(500).send();
      }
    }
  });

  fastify.decorate('deleteUser', async function (req, reply) {
    const username = req.params.user;

    if (req.user.username === username) {
      fastify.logStat('info', 'deleteUser', 'Not allowed to delete self');
      return reply.code(400).send({ message: 'Not allowed to delete self' });
    }

    try {
      await fastify.dbClient.send(new DeleteCommand({
        TableName: fastify.userTable,
        Key: { username },
        ConditionExpression: 'attribute_exists(username)',
      }));
      fastify.logStat('info', 'deleteUser', `Success to delete the user (${username})`);
      return reply.send({ message: 'Success to delete the user' });
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        fastify.logStat('info', 'deleteUser', `The user (${username}) doesn\'t exist`);
        return reply.code(404).send({ message: 'The user doesn\'t exist' });
      } else {
        fastify.logStat('error', 'deleteUser', err);
        return reply.code(500).send();
      }
    }
  });
}, {
  name: 'authHandler',
  dependencies: ['dbInitializer', 'logHandler'],
});