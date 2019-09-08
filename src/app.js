const Koa = require('koa');
const serve = require('koa-static');
const compress = require('koa-compress');
const etag = require('koa-etag');
const conditional = require('koa-conditional-get');
const send = require('koa-send');
const hostname = require('os').hostname();
const path = require('path');
const Z_SYNC_FLUSH = require('zlib').Z_SYNC_FLUSH;
const log = require('@haensl/log');
const pkg = require('./package');

const statuscodes = {
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

const publicDir = process.env.PUBLIC_DIR ||
  path.resolve(__dirname, './public/');

const errorPages = {
  500: path.join(publicDir, '/500/index.html'),
  404: path.join(publicDir, '/400/index.html')
};

const start = async (port) => {
  try {
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
              log.debug('404:', ctx.request);
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

    log.info(`${pkg.name}@${pkg.version} listening on http://${hostname}:${port}`);
    log.debug(`serving ${publicDir}`);

    const cleanup = () => {
      log.info(`${pkg.name}@${pkg.version} shutting down.`);
      server.close();
    };

    process.on('beforeExit', cleanup);
    process.on('uncaughtException', (err) => {
      log.error('Uncaught exception', err);
      cleanup();
      process.exit(1);
    });

    return server;
  } catch (err) {
    log.error(`Failing to start ${pkg.name}@${pkg.version}!`, err);
    process.exit(1);
  }
};

start(process.env.PORT || 8080);
