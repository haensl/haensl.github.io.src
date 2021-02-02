const gulp = require('gulp');
const pfs = require('@haensl/pfs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');
const log = require('@haensl/log');
const pkg = require('./package')

const VERSION = pkg.version;
const DIR_DIST = 'dist';
const DIR_SRC = 'src';
const DIR_SRC_ASSETS = `${DIR_SRC}/assets`;
const DIR_SRC_SEOFILES=`${DIR_SRC}/seofiles`;
const DIR_TEMPLATES = `${DIR_SRC}/templates`;
const DIR_ARTWORK = `${DIR_SRC}/artwork`;
const DIRECTIVE_CSS_INCLUDE = '<!-- INCLUDE_CSS -->';
const DIRECTIVE_INCLUCE_VERSION = '<!-- INCLUDE_VERSION -->';
const DIRECTIVE_INCLUDE_REVISED = '<!-- INCLUDE_REVISED -->';
const sites = require(`./${DIR_TEMPLATES}/sites`);
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
  (pfs.existsSync(dir)
    && pfs.statSync(dir).isDirectory());

const createDir = (dir) =>
  dirExists(dir)
    || pfs.mkdirSync(dir);

const validateAMP = () =>
  gulp.src(`${DIR_DIST}/**/index.html`)
    .pipe($.amphtmlValidator.validate());
    //.pipe($.amphtmlValidator.format());
    //.pipe($.amphtmlValidator.failAfterError());

gulp.task('ensureDistDirExists', (done) => {
  createDir(DIR_DIST)
  done();
});

gulp.task('ensureDistDirsExists',
  gulp.series(
    'ensureDistDirExists',
    (done) => {
      for (const domain of pkg.domains) {
        createDir(path.join(DIR_DIST, `/${domain.domain}`));
        if (domain.includeServer) {
          createDir(path.join(DIR_DIST, `/${domain.domain}/public`));
          createDir(path.join(DIR_DIST, `/${domain.domain}/public/assets`));
        }
      }

      done();
    }
  )
);

gulp.task('clean:seofiles',
  gulp.series(
    'ensureDistDirsExists',
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
    'ensureDistDirsExists',
    () => del(
      `${DIR_DIST}/**/sitemap.xml`,
      { force: true }
    )
  )
);

gulp.task('clean:serverfiles',
  gulp.series(
    'ensureDistDirsExists',
    () => del(
      FILES_SERVER.map((file) => `${DIR_DIST}/**/${file}`),
      { force: true }
    )
  )
);

gulp.task('clean:css',
  gulp.series(
    'ensureDistDirsExists',
    () => del(
      [ `${DIR_DIST}/**/*.css` ],
      { force: true }
    )
  )
);

gulp.task('clean:html',
  gulp.series(
    'ensureDistDirsExists',
    () => del(
      [`${DIR_DIST}/**/*.html`],
      { force: true }
    )
  )
);

gulp.task('clean:assets',
  gulp.series(
    'ensureDistDirsExists',
    () => del(
      [ `${DIR_DIST}/**/assets/*` ],
      { force: true }
    )
  )
);

gulp.task('seofiles',
  gulp.series(
    'clean:seofiles',
    () =>
      Promise.all(
        pkg.domains.map((domain) => new Promise((resolve, reject) => {
            gulp.src(`${DIR_SRC_SEOFILES}/${domain}/*`)
              .pipe(gulp.dest(`${DIR_DIST}/${domain}/`))
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
    () => Promise.all(
      pkg.domains
        .filter((domain) => domain.includeServer)
        .map((domain) => new Promise((resolve, reject) =>
          gulp.src(FILES_SERVER)
            .pipe(gulp.dest(`${DIR_DIST}/${domain.domain}/`))
            .on('end', resolve)
            .on('error', reject))
        )
    )
  )
);

gulp.task('css',
  gulp.series(
    'clean:css',
    () => new Promise((resolve, reject) =>
        gulp.src(`${DIR_SRC}/*.css`)
          .pipe($.postcss([require('autoprefixer')()]))
          .pipe($.cleanCss())
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
      pkg.domains.map((domain) => new Promise((resolve, reject) => {
        const now = (new Date()).toISOString();
        gulp.src(`${DIR_TEMPLATES}/sitemap/template.mustache`)
          .pipe($.mustache({
            domain: domain.domain,
            modified: now
          }))
          .pipe($.rename('sitemap.xml'))
          .pipe(gulp.dest(`${DIR_DIST}/${domain.domain}/${domain.includeServer ? 'public' : ''}`))
          .on('end', resolve)
          .on('error', reject)
      }))
    )
  )
);

gulp.task(
  'templates',
  gulp.series(
    'clean:html',
    async (done) => {
      const components = [
        'footer-menu',
        'language-menu',
        'menu',
        'social-nav',
        'social-nav-small'
      ];

      const skeleton = await Promise.all(
        components
          .map((component) =>
          pfs.readFile(`${DIR_TEMPLATES}/${component}/template.mustache`, 'utf-8'))
      ).then((templates) => templates.reduce((skeleton, template, i) => {
        skeleton[components[i]] = template;
        return skeleton;
      }, {}));

      const skeletonLocalizations = pkg.langs
        .reduce((localizations, lang) => {
          localizations[lang] = components
            .reduce((localizedComponents, component) => {
              let i18n = `${DIR_TEMPLATES}/${component}/i18n/${lang}.json`;

              if (!pfs.existsSync(i18n)) {
                i18n = `${DIR_TEMPLATES}/${component}/i18n/en.json`;
              }

              if (!pfs.existsSync(i18n)) {
                log.warn(`Missing localization [${lang}] for ${component}.`)
              }

              return {
                ...localizedComponents,
                ...require(path.resolve(i18n))
              };
            }, {});
          return localizations;
        }, {});


      const promises = [];

      for (const domain of pkg.domains) {
        for (const site of sites) {
          const template = await pfs.readFile(`${DIR_TEMPLATES}/${site}/template.mustache`, 'utf-8');

          const vars = {
            ...skeletonLocalizations[domain.lang],
            ...require(path.resolve(`${DIR_TEMPLATES}/index/i18n/${domain.lang}.json`)),
            ...require(path.resolve(`${DIR_TEMPLATES}/${site}/i18n/${domain.lang}.json`)),
            site,
            domain: domain.domain,
            lang: domain.lang,
            year: (new Date()).getFullYear(),
            path: `${site === 'about' ? '/' : `/${site}`}`
          };

          for (const item of vars.menuItems) {
            item.active = item.id === site;
          }

          for (const item of vars.footerMenuItems) {
            item.active = item.id === site;
          };

          const destDir = `${DIR_DIST}/${domain.domain}/${domain.includeServer ? 'public' : ''}/${site !== 'about' ? `${site}/` : ''}`;

          await new Promise((resolve, reject) => {
            gulp.src(`${DIR_TEMPLATES}/index/template.mustache`)
              .pipe($.mustache(
                vars,
                {},
                {
                  view: template,
                  ...skeleton
                }
              ))
              .pipe($.rename((path) => {
                path.basename = 'index';
                path.extname = '.html';
                return path;
              }))
              .pipe(gulp.dest(destDir))
              .on('end', resolve)
              .on('error', reject);
          });
        }
      }

      done();
    }
  )
);

gulp.task('html',
  gulp.series(
    gulp.parallel(
      'templates',
      'css'
    ),
    () => Promise.all(
      pkg.domains
        .map((domain) => new Promise((resolve, reject) => {
          gulp.src(`${DIR_DIST}/${domain.domain}/**/*.html`)
            .pipe($.replace(DIRECTIVE_CSS_INCLUDE, (match) => `<style amp-custom>${ pfs.readFileSync(path.join(DIR_DIST, 'style.tmp.css'))}</style>`))
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
            .pipe(gulp.dest(`${DIR_DIST}/${domain.domain}`))
            .on('end', resolve)
            .on('error', reject);
        })
      )
    )
  )
);

gulp.task('github:errorPages:prependFrontMatter',
  gulp.series(
    'html',
    () => Promise.all(
      pkg.domains
        .filter((domain) => domain.isGithub)
        .map((domain) => new Promise((resolve, reject) =>
           gulp.src(`${DIR_DIST}/${domain.domain}/404/index.html`)
            .pipe($.insert.prepend('---\npermalink: /404.html\n---\n'))
            .pipe($.rename((path) => {
              path.basename = '404';
              return path;
            }))
            .pipe(gulp.dest(`${DIR_DIST}/${domain.domain}`))
            .on('end', resolve)
            .on('error', reject)
        ))
    )
  )
);

gulp.task('github:errorPages',
  gulp.series(
    'github:errorPages:prependFrontMatter',
    () => Promise.all(
      pkg.domains
        .filter((domain) => domain.isGithub)
        .map((domain) => del(
          [
            `${DIR_DIST}/${domain.domain}/404/index.html`,
            `${DIR_DIST}/${domain.domain}/404`
          ],
          { force: true }
        ))
    )
  )
);

gulp.task('compile',
  gulp.series(
    'github:errorPages',
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
    () => Promise.all(
      pkg.domains
        .map((domain) => new Promise((resolve, reject) =>
          gulp.src(`${DIR_SRC}/assets/+(img|docs|poe)/*`)
          .pipe(gulp.dest(`${DIR_DIST}/${domain.domain}/${domain.includeServer ? 'public' : ''}/assets`))
            .on('end', resolve)
            .on('error', reject)
        ))
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
      baseDir: `${DIR_DIST}/haensl.github.io`
    }
  });
  done();
  log.info('Production server listening on http://localhost:8080');
  log.info('Browser sync server listening on http://localhost:3000');
});

gulp.task('default', gulp.series('watch'));
