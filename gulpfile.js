const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');
const readline = require('readline');

const VERSION = require('./package').version;
const FOLDER_DIST = 'dist';
const FOLDER_DIST_ASSETS = `${FOLDER_DIST}/assets`;
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
  'sitemap.xml',
  'robots.txt',
  'google606a8a6b7c2ee7a1.html'
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

gulp.task('ensureDistAssetsFolderExists', ['ensureDistFolderExists'], () =>
  createFolder(FOLDER_DIST_ASSETS));

gulp.task('clean:seofiles', ['ensureDistFolderExists'], () =>
  del.sync(FILES_SEO.map((file) => `${FOLDER_DIST}/${file}`), { force: true }));

gulp.task('clean:css', ['ensureDistFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/*.css`], {
    force: true
  }));

gulp.task('clean:html', ['ensureDistFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/**/*.html`], {
    force: true
  }));

gulp.task('clean:assets', ['ensureDistAssetsFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/assets/*`], {
    force: true
  }));

gulp.task('seofiles', ['clean:seofiles'], () =>
  new Promise((resolve, reject) =>
    gulp.src(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`))
      .pipe(gulp.dest(FOLDER_DIST))
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

gulp.task('templates', ['clean:html'], (done) =>
  Promise.all(TEMPLATE_SITES.map((site) =>
    new Promise((resolve, reject) => {
      fs.readFile(`${FOLDER_PARTIALS}/${site.name}.mustache`, 'utf8', (err, partial) => {
        if (err) {
          return reject(err);
        }

        const vars = Object.assign(
          {},
          JSON.parse(JSON.stringify(TEMPLATE_VARS)),
          {
            site: site.name
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
          .pipe(gulp.dest(`${FOLDER_DIST}/${site.name !== 'about' ? `${site.name}/` : ''}`))
          .on('end', resolve)
          .on('error', reject);
      });
  })
)));

gulp.task('html', ['templates', 'css'], () =>
  new Promise((resolve, reject) =>
    gulp.src(`${FOLDER_DIST}/**/*.html`)
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
      .pipe(gulp.dest(FOLDER_DIST))
      .on('end', resolve)
      .on('error', reject)));

gulp.task('compile', ['html'], () => {
  del.sync(path.join(FOLDER_DIST, 'style.tmp.css'));
  browserSync.reload();
  validateAMP();
});

gulp.task('assets', ['clean:assets'], () =>
  gulp.src(`${FOLDER_SRC}/assets/+(img|docs)/*`)
    .pipe(gulp.dest(FOLDER_DIST_ASSETS)));

gulp.task('default', ['compile', 'assets', 'seofiles'], () => {
  validateAMP();
  browserSync({
    server: FOLDER_DIST
  });

  gulp.watch(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`), ['seofiles']);
  gulp.watch(`${FOLDER_SRC}/**/*.+(css|mustache)`, ['compile']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/*/*`, ['assets']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/json/*`, ['compile']);
});
