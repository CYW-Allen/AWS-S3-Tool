import fastifyPlugin from "fastify-plugin";
import log from 'npmlog';
import dayjs from 'dayjs';

log.prefixStyle.bold = true;
log.prefixStyle.fg = 'blue';
log.headingStyle.fg = 'yellow';

export default fastifyPlugin(async function (fastify, opts) {
  fastify.decorate('logStat', function (type, caller, content) {
    log.heading = dayjs(Date.now() + Number(process.env.UTCOFFSET)).format('YYYY/MM/DD HH:mm:ss');
    log[type](`[${caller}]`, content);
  });
}, { name: 'logHandler' });