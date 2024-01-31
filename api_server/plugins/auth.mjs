import fastifyPlugin from "fastify-plugin";
import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
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
    const curTime = dayjs(Date.now() + Number(process.env.UTCOFFSET)).format('YYYY/MM/DD HH:mm:ss');
    const bucketScope = [process.env.DEFAULT_SCOPE];
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
      return reply.send({ token: fastify.jwt.sign({ username, bucketScope, isAdmin }) })
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
          ':v_lastLogin': dayjs(Date.now() + Number(process.env.UTCOFFSET)).format('YYYY/MM/DD HH:mm:ss'),
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
            bucketScope: result.bucketScope,
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
    const bucket = req.params.bucket || req.query.bucket;

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

  fastify.decorate('editPermission', async function (req, reply) {
    const username = req.params.user;
    const { scope, isAdmin } = req.body;

    try {
      await fastify.dbClient.send(new UpdateCommand({
        TableName: fastify.userTable,
        Key: { username },
        UpdateExpression: `SET bucketScope = :v_scope, isAdmin = :v_isAdmin`,
        ConditionExpression: 'attribute_exists(username)',
        ExpressionAttributeValues: {
          ':v_scope': scope,
          ':v_isAdmin': isAdmin,
        },
      }));
      fastify.logStat('info', 'editPermission', `Update user (${username}) permission. scope: ${scope}, isAdmin: ${isAdmin})`);
      return reply.send({ message: 'Success to update permission' });
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        fastify.logStat('info', 'editPermission', `The user (${username}) doesn\'t exist`);
        return reply.code(404).send({ message: 'The user doesn\'t exist' });
      } else {
        fastify.logStat('error', 'editPermission', err);
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

  fastify.decorate('listUsers', async function (req, reply) {
    try {
      const users = [];
      const dbCmd = new ScanCommand({
        TableName: fastify.userTable,
        ProjectionExpression: 'username,bucketScope,createdAt,lastLogin,isAdmin',
      });

      do {
        const { Items, LastEvaluatedKey } = await fastify.dbClient.send(dbCmd);

        for (let i = 0; i < Items.length; i++) users.push(Items[i]);
        dbCmd.input.ExclusiveStartKey = LastEvaluatedKey;
      } while (dbCmd.input.ExclusiveStartKey);
      return reply.send({ data: users });
    } catch (err) {
      fastify.logStat('error', 'root->listUsers', err);
      return reply.code(500).send();
    }
  });
}, {
  name: 'authHandler',
  dependencies: ['dbInitializer', 'logHandler'],
});