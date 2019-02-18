const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');

const VERSION = require('./package').version;
const DIR_DIST = 'dist';
const DIR_DIST_GITHUB_IO = `${DIR_DIST}/haensl.github.io`;
const DIR_DIST_STANDALONE = `${DIR_DIST}/hpdietz.com`;
const DIR_ASSETS_GITHUB_IO = `${DIR_DIST_GITHUB_IO}/assets`;
const DIR_ASSETS_STANDALONE = `${DIR_DIST_STANDALONE}/assets`;
const DIR_SRC = 'src';
const DIR_SRC_ASSETS = `${DIR_SRC}/assets`;
const DIR_SRC_SEOFILES=`${DIR_SRC}/seofiles`;
const DIR_TEMPLATES = `${DIR_SRC}/templates`;
const DIR_PARTIALS = `${DIR_TEMPLATES}/partials`;
const DIR_ARTWORK = `${DIR_SRC}/artwork`;
const DIRECTIVE_CSS_INCLUDE = '<!-- INCLUDE_CSS -->';
const DIRECTIVE_INCLUCE_VERSION = '<!-- INCLUDE_VERSION -->';
const DIRECTIVE_INCLUDE_REVISED = '<!-- INCLUDE_REVISED -->';
const TEMPLATE_VARS = require(`./${DIR_TEMPLATES}/vars`);
const TEMPLATE_SITES = require(`./${DIR_TEMPLATES}/sites`);
const DATE_NOW_ISO = (new Date()).toISOString();

const OPTS_HTMLMIN = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true
};

const FILES_SERVER = [
  'package.json',
  'package-lock.json',
  `${DIR_SRC}/app.js`
];


const dirExists = (dir) =>
  (fs.existsSync(dir)
    && fs.statSync(dir).isDirectory());

const createDir = (dir) =>
  dirExists(dir)
    || fs.mkdirSync(dir);

const validateAMP = () =>
  gulp.src(`${DIR_DIST}/**/index.html`)
    .pipe($.amphtmlValidator.validate())
    .pipe($.amphtmlValidator.format());
    //.pipe($.amphtmlValidator.failAfterError());

gulp.task('ensureDistDirExists', (done) => {
  createDir(DIR_DIST)
  done();
});

gulp.task('ensureGithubIODistDirExists',
  gulp.series(
    'ensureDistDirExists',
    (done) => {
      createDir(DIR_DIST_GITHUB_IO);
      done();
    }
  )
);

gulp.task('ensureStandaloneDistDirExists',
  gulp.series(
    'ensureDistDirExists',
    (done) => {
      createDir(DIR_DIST_STANDALONE);
      done();
    }
  )
);

gulp.task('ensureGithubIOAssetsDirExists',
  gulp.series(
    'ensureGithubIODistDirExists',
    (done) => {
      createDir(DIR_ASSETS_GITHUB_IO);
      done();
    }
  )
);

gulp.task('ensureStandaloneAssetsDirExists',
  gulp.series(
    'ensureStandaloneDistDirExists',
    (done) => {
      createDir(DIR_ASSETS_STANDALONE);
      done();
    }
  )
);

gulp.task('ensureDistAssetsDirExists',
  gulp.parallel(
    'ensureGithubIOAssetsDirExists',
    'ensureStandaloneAssetsDirExists'
  )
);

gulp.task('clean:seofiles',
  gulp.series(
    gulp.parallel(
      'ensureStandaloneDistDirExists',
      'ensureGithubIODistDirExists'
    ),
    () => del(
      [
        `${DIR_DIST}/**/google*+.html`,
        `${DIR_DIST}/**/robots.txt`
      ],
      { force: true }
    )
  )
);

gulp.task('clean:sitemap',
  gulp.series(
    gulp.parallel(
      'ensureStandaloneDistDirExists',
      'ensureGithubIOAssetsDirExists'
    ),
    () => del(
      `${DIR_DIST}/**/sitemap.xml`,
      { force: true }
    )
  )
);

gulp.task('clean:serverfiles',
  gulp.series(
    'ensureStandaloneDistDirExists',
    () => del(
      FILES_SERVER.map((file) => `${DIR_DIST_STANDALONE}/${file}`),
      { force: true }
    )
  )
);

gulp.task('clean:css',
  gulp.series(
    gulp.parallel(
      'ensureStandaloneDistDirExists',
      'ensureGithubIODistDirExists'
    ),
    () => del(
      [ `${DIR_DIST}/**/*.css` ],
      { force: true }
    )
  )
);

gulp.task('clean:html',
  gulp.series(
    gulp.parallel(
      'ensureStandaloneDistDirExists',
      'ensureGithubIODistDirExists'
    ),
    () => del(
      [`${DIR_DIST}/**/*.html`],
      { force: true }
    )
  )
);

gulp.task('clean:assets',
  gulp.series(
    'ensureDistAssetsDirExists',
    () => del(
      [
        `${DIR_ASSETS_GITHUB_IO}/*`,
        `${DIR_ASSETS_STANDALONE}/*`
      ],
      { force: true }
    )
  )
);

gulp.task('seofiles',
  gulp.series(
    'clean:seofiles',
    () =>
      Promise.all(
        [
          DIR_DIST_STANDALONE,
          DIR_DIST_GITHUB_IO
        ].map((distDir) => new Promise((resolve, reject) => {
            const domain = distDir.slice(5);
            gulp.src(`${DIR_SRC_SEOFILES}/${domain}/*`)
              .pipe(gulp.dest(distDir))
              .on('end', resolve)
              .on('error', reject);
          })
        )
      )
  )
);

gulp.task('server',
  gulp.series(
    'clean:serverfiles',
    () => new Promise((resolve, reject) =>
      gulp.src(FILES_SERVER)
        .pipe(gulp.dest(DIR_DIST_STANDALONE))
        .on('end', resolve)
        .on('error', reject))
  )
);

gulp.task('css',
  gulp.series(
    'clean:css',
    () => new Promise((resolve, reject) =>
      gulp.src(`${DIR_SRC}/*.css`)
        .pipe($.postcss([require('autoprefixer')()]))
        .pipe($.cssmin())
        .pipe($.rename((path) => {
          path.basename = `${path.basename}.tmp`
          return path;
        }))
        .pipe(gulp.dest(DIR_DIST))
        .on('end', resolve)
        .on('error', reject)
    )
  )
);

gulp.task('sitemap',
  gulp.series(
    'clean:sitemap',
    () => Promise.all(
      [
        DIR_DIST_STANDALONE,
        DIR_DIST_GITHUB_IO
      ].map((channel) => new Promise((resolve, reject) => {
        const domain = channel.slice(5);
        gulp.src(`${DIR_PARTIALS}/sitemap.mustache`)
          .pipe($.mustache({
            domain
          }))
          .pipe($.rename((path) => {
            path.extname = '.xml';
            return path;
          }))
          .pipe(gulp.dest(`${channel}/`))
          .on('end', resolve)
          .on('error', reject)
      }))
    )
  )
);

gulp.task('templates',
  gulp.series(
    'clean:html',
    () => Promise.all(
      TEMPLATE_SITES.map((site) =>
        new Promise((resolve, reject) => {
          fs.readFile(
            `${DIR_PARTIALS}/${site.partial}.mustache`,
            'utf8',
            (err, partial) => {
              if (err) {
                return reject(err);
              }

              Promise.all([
                DIR_DIST_STANDALONE,
                DIR_DIST_GITHUB_IO
              ].map((channel) =>
                new Promise((resolve, reject) => {
                  const vars = Object.assign(
                    {},
                    JSON.parse(JSON.stringify(TEMPLATE_VARS)),
                    {
                      site: site.name,
                      domain: channel.slice(5)
                    },
                    site.vars
                  );
                  vars.menuItems.map((item) => {
                    item.active = item.name === site.name;
                    return item;
                  });
                  vars.footerMenuItems.map((item) => {
                    item.active = item.name === site.name;
                    return item;
                  });
                  gulp.src(`${DIR_PARTIALS}/base.mustache`)
                    .pipe($.mustache(vars, {}, {
                      view: partial
                    }))
                    .pipe($.rename((path) => {
                      path.basename = 'index';
                      path.extname = '.html';
                      return path;
                    }))
                    .pipe(gulp.dest(`${channel}/${site.name !== 'about' ? `${site.partial}/` : ''}`))
                    .on('end', resolve)
                    .on('error', reject);
                })))
                .then(resolve)
                .catch(reject);
            }
          );
        })
      )
    )
  )
);

gulp.task('html',
  gulp.series(
    gulp.parallel(
      'templates',
      'css'
    ),
    () => Promise.all(
      [
        DIR_DIST_GITHUB_IO,
        DIR_DIST_STANDALONE
      ].map((distDir) => new Promise((resolve, reject) =>
        gulp.src(`${distDir}/**/*.html`)
          .pipe($.replace(DIRECTIVE_CSS_INCLUDE, (match) => `<style amp-custom>${ fs.readFileSync(path.join(DIR_DIST, 'style.tmp.css'))}</style>`))
          .pipe($.replace(DIRECTIVE_INCLUCE_VERSION, (match) => `<meta name="version" content="${VERSION}" >`))
          .pipe($.replace(DIRECTIVE_INCLUDE_REVISED, (match => `<meta name="revised" content="${ DATE_NOW_ISO }"><meta name="date" content="${ DATE_NOW_ISO }">`)))
          .pipe($.embedJson({
            root: path.join(DIR_SRC_ASSETS, 'json')
          }))
          .pipe($.embedSvg({
            root: path.join(__dirname, 'src/artwork'),
            createSpritesheet: true
          }))
          .pipe($.htmlmin(OPTS_HTMLMIN))
          .pipe(gulp.dest(distDir))
          .on('end', resolve)
          .on('error', reject))
      )
    )
  )
);

gulp.task('githubErrorPages:prependFrontMatter',
  gulp.series(
    'html',
    () => new Promise((resolve, reject) =>
      gulp.src(`${DIR_DIST_GITHUB_IO}/404/index.html`)
        .pipe($.insert.prepend('---\npermalink: /404.html\n---\n'))
        .pipe($.rename((path) => {
          path.basename = '404';
          return path;
        }))
        .pipe(gulp.dest(`${DIR_DIST_GITHUB_IO}`))
        .on('end', resolve)
        .on('error', reject)
                     )
  )
);

gulp.task('githubErrorPages',
  gulp.series(
    'githubErrorPages:prependFrontMatter',
    () => del(
      [
        `${DIR_DIST_GITHUB_IO}/404/index.html`,
        `${DIR_DIST_GITHUB_IO}/404`
      ],
      { force: true }
    )
  )
);

gulp.task('compile',
  gulp.series(
    'githubErrorPages',
    () => del(
        path.join(DIR_DIST, 'style.tmp.css'),
        { force: true }
    ).then(() => {
      browserSync.reload();
      validateAMP();
    })
  )
);

gulp.task('assets',
  gulp.series(
    'clean:assets',
    () => new Promise((resolve, reject) =>
      gulp.src(`${DIR_SRC}/assets/+(img|docs|poe)/*`)
        .pipe(gulp.dest(DIR_ASSETS_GITHUB_IO))
        .pipe(gulp.dest(DIR_ASSETS_STANDALONE))
        .on('end', resolve)
        .on('error', reject)
    )
  )
);

gulp.task('build',
  gulp.parallel(
    'compile',
    'assets',
    'sitemap',
    'seofiles',
    'server'
  )
);

gulp.task('watch',
  gulp.series(
    'build',
    (done) => {
      gulp.watch(`${DIR_SRC_SEOFILES}/**/*`, gulp.series('seofiles'));
      gulp.watch(FILES_SERVER, gulp.series('server'));
      gulp.watch(`${DIR_SRC}/**/*.+(css|mustache)`, gulp.series('compile'));
      gulp.watch(`${DIR_SRC_ASSETS}/*/*`, gulp.series('assets'));
      gulp.watch(`${DIR_SRC_ASSETS}/json/*`, gulp.series('compile'));
      gulp.watch(`${DIR_ARTWORK}/*.svg`, gulp.series('html'));
      done();
    }
  )
);

gulp.task('serve', (done) => {
  browserSync.init({
    server: {
      baseDir: DIR_DIST_GITHUB_IO
    }
  });
  done();
});

gulp.task('default', gulp.series('watch'));
