import fastifyPlugin from "fastify-plugin";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export default fastifyPlugin(async function (fastify, opts) {
  fastify.decorate('dbClient', DynamoDBDocumentClient.from(
    new DynamoDBClient({
      ...(process.env.NODE_ENV === 'dev' && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      }),
      region: process.env.AWS_DB_REGION,
    })
  ));
  fastify.decorate('userTable', process.env.AUTH_TABLE);
  fastify.decorate('historyTable', process.env.HISTORY_TABLE);
}, { name: 'dbInitializer' });