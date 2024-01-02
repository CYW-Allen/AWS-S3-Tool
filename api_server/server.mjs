import fastify from "fastify";
import initSvr from './app.mjs';

const apiServer = fastify();

initSvr(apiServer);

export default apiServer;