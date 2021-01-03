const Koa = require('koa');
const serve = require('koa-static');
const compress = require('koa-compress');
const etag = require('koa-etag');
const conditional = require('koa-conditional-get');
const send = require('koa-send');
const gracefulShutdown = require('http-graceful-shutdown');
const hostname = require('os').hostname();
const path = require('path');
const Z_SYNC_FLUSH = require('zlib').Z_SYNC_FLUSH;
const log = require('@haensl/log');
const {
  name,
  version
} = require('./package');

const statuscodes = {
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

const publicDir = process.env.PUBLIC_DIR ||
  path.resolve(__dirname, './public/');

const start = async (port) => {
  const server = new Koa();
  server
    .use(async (ctx, next) => {
      try {
        await next();
        const status = ctx.status || statuscodes.NOT_FOUND;
        if (status === statuscodes.NOT_FOUND) {
          ctx.throw(statuscodes.NOT_FOUND);
        }
      } catch (err) {
        ctx.status = err.status || statuscodes.INTERNAL_SERVER_ERROR;
        let errorPage;
        switch (ctx.status) {
          case 404:
            log.debug('404: Not Found', ctx.request);
            ctx.redirect('/404');
            break;
          default:
            log.error('500: Internal Server Error', err, 'Request', ctx.request);
            ctx.redirect('/500');
            break;
        }
      }
    })
    .use(compress({
      threshold: process.env.COMPRESSION_THRESHOLD || 0,
      flush: Z_SYNC_FLUSH
    }))
    .use(conditional())
    .use(etag())
    .use(serve(publicDir, {
      maxage: process.env.PUBLIC_CACHE_MAXAGE || 0
    }));

  await server.listen(port);

  log.info(`${name}@${version} listening on http://${hostname}:${port}`);
  log.debug(`serving ${publicDir}`);

  log.debug('attaching shutdown handler');
  gracefulShutdown(
    server,
    {
      development: process.env.NODE_ENV !== 'production',
      finally: () => {
        log.info(`${name}@${version} shutting down gracefully.`);
        process.exit(0);
      }
    }
  );

  server.on('error', (error) => {
    log.error('Uncaught Koa error', error);
  });
};

start(process.env.PORT || 8080)
  .catch((error) => {
    log.error(`Failing to start ${name}@${version}`, error);
    process.exit(1);
  });
