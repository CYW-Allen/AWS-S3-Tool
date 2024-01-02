import awsLambdaFastify from "@fastify/aws-lambda";
import server from './server.mjs';

export const handler = awsLambdaFastify(server);

await server.ready();