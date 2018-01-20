const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');
const readline = require('readline');

const VERSION = require('./package').version;
const FOLDER_DIST = 'dist';
const FOLDER_DIST_GITHUB_IO = `${FOLDER_DIST}/haensl.github.io`;
const FOLDER_DIST_STANDALONE = `${FOLDER_DIST}/hpdietz.com`;
const FOLDER_ASSETS_GITHUB_IO = `${FOLDER_DIST_GITHUB_IO}/assets`;
const FOLDER_ASSETS_STANDALONE = `${FOLDER_DIST_STANDALONE}/assets`;
const FOLDER_SRC = 'src';
const FOLDER_SRC_ASSETS = `${FOLDER_SRC}/assets`;
const FOLDER_TEMPLATES = `${FOLDER_SRC}/templates`;
const FOLDER_PARTIALS = `${FOLDER_TEMPLATES}/partials`;
const DIRECTIVE_CSS_INCLUDE = '<!-- INCLUDE_CSS -->';
const DIRECTIVE_INCLUCE_VERSION = '<!-- INCLUDE_VERSION -->';
const DIRECTIVE_INCLUDE_REVISED = '<!-- INCLUDE_REVISED -->';
const TEMPLATE_VARS = require(`./${FOLDER_TEMPLATES}/vars`);
const TEMPLATE_SITES = require(`./${FOLDER_TEMPLATES}/sites`);

const OPTS_HTMLMIN = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true
};
const FILES_SEO = [
  'robots.txt',
  'google606a8a6b7c2ee7a1.html'
];
const FILES_SERVER = [
  'package.json',
  'pm2.json',
  `${FOLDER_SRC}/app.js`
];

const folderExists = (folder) =>
  (fs.existsSync(folder)
    && fs.statSync(folder).isDirectory());

const createFolder = (folder) =>
  folderExists(folder)
    || fs.mkdirSync(folder);

const validateAMP = () =>
  gulp.src(`${FOLDER_DIST}/**/index.html`)
    .pipe($.amphtmlValidator.validate())
    .pipe($.amphtmlValidator.format())
    .pipe($.amphtmlValidator.failAfterError());

gulp.task('ensureDistFolderExists', () =>
  createFolder(FOLDER_DIST));

gulp.task('ensureGithubIODistFolderExists', ['ensureDistFolderExists'], () =>
  createFolder(FOLDER_DIST_GITHUB_IO));

gulp.task('ensureStandaloneDistFolderExists', ['ensureDistFolderExists'], () =>
  createFolder(FOLDER_DIST_STANDALONE));

gulp.task('ensureGithubIOAssetsFolderExists', ['ensureGithubIODistFolderExists'], () =>
  createFolder(FOLDER_ASSETS_GITHUB_IO));

gulp.task('ensureStandaloneAssetsFolderExists', ['ensureStandaloneDistFolderExists'], () =>
  createFolder(FOLDER_ASSETS_STANDALONE));

gulp.task('ensureDistAssetsFolderExists', ['ensureGithubIOAssetsFolderExists', 'ensureStandaloneAssetsFolderExists']);

gulp.task('clean:seofiles', ['ensureStandaloneDistFolderExists', 'ensureGithubIODistFolderExists'], () =>
  del.sync(FILES_SEO.map((file) => `${FOLDER_DIST}/**/${path.basename(file)}`), {
    force: true
  }));

gulp.task('clean:sitemap', ['ensureStandaloneDistFolderExists', 'ensureGithubIOAssetsFolderExists'], () =>
  del.sync(`${FOLDER_DIST}/**/sitemap.xml`, {
    force: true
  }));

gulp.task('clean:serverfiles', ['ensureStandaloneDistFolderExists'], () =>
  del.sync(FILES_SERVER.map((file) => `${FOLDER_DIST_STANDALONE}/${file}`), {
    force: true
  }));

gulp.task('clean:css', ['ensureStandaloneDistFolderExists', 'ensureGithubIODistFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/**/*.css`], {
    force: true
  }));

gulp.task('clean:html', ['ensureStandaloneDistFolderExists', 'ensureGithubIODistFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/**/*.html`], {
    force: true
  }));

gulp.task('clean:assets', ['ensureDistAssetsFolderExists'], () =>
  del.sync([`${FOLDER_ASSETS_GITHUB_IO}/*`, `${FOLDER_ASSETS_STANDALONE}/*`], {
    force: true
  }));

gulp.task('seofiles', ['clean:seofiles'], () =>
  new Promise((resolve, reject) =>
    gulp.src(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`))
      .pipe(gulp.dest(FOLDER_DIST_STANDALONE))
      .pipe(gulp.dest(FOLDER_DIST_GITHUB_IO))
      .on('end', resolve)
      .on('error', reject)));

gulp.task('server', ['clean:serverfiles'], () =>
  new Promise((resolve, reject) =>
    gulp.src(FILES_SERVER)
      .pipe(gulp.dest(FOLDER_DIST_STANDALONE))
      .on('end', resolve)
      .on('error', reject)));

gulp.task('css', ['clean:css'], () =>
  new Promise((resolve, reject) =>
    gulp.src(`${FOLDER_SRC}/*.css`)
      .pipe($.postcss([require('autoprefixer')()]))
      .pipe($.cssmin())
      .pipe($.rename((path) => {
        path.basename = `${path.basename}.tmp`
        return path;
      }))
      .pipe(gulp.dest(FOLDER_DIST))
      .on('end', resolve)
      .on('error', reject)));

gulp.task('sitemap', ['clean:sitemap'], () =>
  Promise.all([
    FOLDER_DIST_STANDALONE,
    FOLDER_DIST_GITHUB_IO
  ].map((channel) => new Promise((resolve, reject) => {
    const domain = channel.slice(5);
    gulp.src(`${FOLDER_PARTIALS}/sitemap.mustache`)
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
    }))));

gulp.task('templates', ['clean:html'], () =>
  Promise.all(TEMPLATE_SITES.map((site) =>
    new Promise((resolve, reject) => {
      fs.readFile(`${FOLDER_PARTIALS}/${site.name}.mustache`, 'utf8', (err, partial) => {
        if (err) {
          return reject(err);
        }

        Promise.all([
          FOLDER_DIST_STANDALONE,
          FOLDER_DIST_GITHUB_IO
        ].map((channel) =>
          new Promise((resolve, reject) => {
            let vars = Object.assign(
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
            gulp.src(`${FOLDER_PARTIALS}/base.mustache`)
              .pipe($.mustache(vars, {}, {
                view: partial
              }))
              .pipe($.rename((path) => {
                path.basename = 'index';
                path.extname = '.html';
                return path;
              }))
              .pipe(gulp.dest(`${channel}/${site.name !== 'about' ? `${site.name}/` : ''}`))
              .on('end', resolve)
              .on('error', reject);
          })))
          .then(resolve)
          .catch(reject);
      });
  })
)));

gulp.task('html', ['templates', 'css'], () =>
  Promise.all([
    FOLDER_DIST_GITHUB_IO,
    FOLDER_DIST_STANDALONE
  ].map((distFolder) =>
    new Promise((resolve, reject) =>
      gulp.src(`${distFolder}/**/*.html`)
        .pipe($.replace(DIRECTIVE_CSS_INCLUDE, (match) => `<style amp-custom>${ fs.readFileSync(path.join(FOLDER_DIST, 'style.tmp.css'))}</style>`))
        .pipe($.replace(DIRECTIVE_INCLUCE_VERSION, (match) => `<meta name="version" content="${VERSION}" >`))
        .pipe($.replace(DIRECTIVE_INCLUDE_REVISED, (match => {
          const isoDate = (new Date()).toISOString();
          let metaRevised = `<meta name="revised" content="${ isoDate }">`;
          metaRevised = `${metaRevised}<meta name="date" content="${ isoDate }">`;
          return metaRevised;
        })))
        .pipe($.embedJson({
          root: path.join(FOLDER_SRC_ASSETS, 'json')
        }))
        .pipe($.embedSvg({
          root: path.join(__dirname, 'src/artwork')
        }))
        .pipe($.htmlmin(OPTS_HTMLMIN))
        .pipe(gulp.dest(distFolder))
        .on('end', resolve)
        .on('error', reject)))));

gulp.task('githubErrorPages:prependFrontMatter', ['html'], () =>
  gulp.src(`${FOLDER_DIST_GITHUB_IO}/404/index.html`)
    .pipe($.insert.prepend('---\npermalink: /404.html\n---\n'))
    .pipe($.rename((path) => {
      path.basename = '404';
      return path;
    }))
    .pipe(gulp.dest(`${FOLDER_DIST_GITHUB_IO}`)));

gulp.task('githubErrorPages', ['githubErrorPages:prependFrontMatter'], () => {
  del.sync([`${FOLDER_DIST_GITHUB_IO}/404/index.html`, `${FOLDER_DIST_GITHUB_IO}/404`], {
    force: true
  });
});

gulp.task('compile', ['githubErrorPages'], () => {
  del.sync(path.join(FOLDER_DIST, 'style.tmp.css'));
  browserSync.reload();
  validateAMP();
});

gulp.task('assets', ['clean:assets'], () =>
  gulp.src(`${FOLDER_SRC}/assets/+(img|docs)/*`)
    .pipe(gulp.dest(FOLDER_ASSETS_GITHUB_IO))
    .pipe(gulp.dest(FOLDER_ASSETS_STANDALONE)));

gulp.task('build', ['compile', 'assets', 'sitemap', 'seofiles', 'server']);

gulp.task('watch', ['build'], () => {
  gulp.watch(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`), ['seofiles']);
  gulp.watch(FILES_SERVER, ['server']);
  gulp.watch(`${FOLDER_SRC}/**/*.+(css|mustache)`, ['compile']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/*/*`, ['assets']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/json/*`, ['compile']);
});

gulp.task('default', ['watch'], () => {
  browserSync.init({
    server: {
      baseDir: FOLDER_DIST_GITHUB_IO
    }
  });
});
