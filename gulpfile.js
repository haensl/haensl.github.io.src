const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');
const readline = require('readline');

const VERSION = require('./package').version;
const CHANGELOG = 'CHANGELOG.md';
const FOLDER_DIST = 'dist';
const FOLDER_DIST_ASSETS = `${FOLDER_DIST}/assets`;
const FOLDER_SRC = 'src';
const FOLDER_SRC_ASSETS = `${FOLDER_SRC}/assets`;
const DIRECTIVE_CSS_INCLUDE = '<!-- INCLUDE_CSS -->';
const DIRECTIVE_INCLUCE_VERSION = '<!-- INCLUDE_VERSION -->';
const DIRECTIVE_INCLUDE_REVISED = '<!-- INCLUDE_REVISED -->';
const OPTS_HTMLMIN = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true
};
const FILES_SEO = [
  'sitemap.xml',
  'robots.txt'
];

const folderExists = (folder) =>
  (fs.existsSync(folder)
    && fs.statSync(folder).isDirectory());

const createFolder = (folder) =>
  folderExists(folder)
    || fs.mkdirSync(folder);

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
  del.sync([`${FOLDER_DIST}/*.html`], {
    force: true
  }));

gulp.task('clean:assets', ['ensureDistAssetsFolderExists'], () =>
  del.sync([`${FOLDER_DIST}/assets/*`], {
    force: true
  }));

gulp.task('seofiles', ['clean:seofiles'], () =>
  gulp.src(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`))
    .pipe(gulp.dest(FOLDER_DIST)));

gulp.task('css', ['clean:css'], () =>
  gulp.src(`${FOLDER_SRC}/*.css`)
    .pipe($.postcss([require('autoprefixer')()]))
    .pipe($.cssmin())
    .pipe($.rename((path) => {
      path.basename = `${path.basename}.tmp`
      return path;
    }))
    .pipe(gulp.dest(FOLDER_DIST)));

gulp.task('html', ['clean:html', 'css'], () =>
  gulp.src(`${FOLDER_SRC}/*.html`)
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
    .pipe(gulp.dest(FOLDER_DIST)));

gulp.task('compile', ['css', 'html'], () => {
  del.sync(path.join(FOLDER_DIST, 'style.tmp.css'));
  browserSync.reload();
});

gulp.task('assets', ['clean:assets'], () =>
  gulp.src(`${FOLDER_SRC}/assets/+(img|docs)/*`)
    .pipe(gulp.dest(FOLDER_DIST_ASSETS)));

gulp.task('amp:validate', ['compile'], () =>
  gulp.src(`${FOLDER_DIST}/index.html`)
    .pipe($.amphtmlValidator.validate())
    .pipe($.amphtmlValidator.format())
    .pipe($.amphtmlValidator.failAfterError()));

gulp.task('default', ['compile', 'assets', 'seofiles', 'amp:validate'], () => {
  browserSync({
    server: FOLDER_DIST
  });

  gulp.watch(FILES_SEO.map((file) => `${FOLDER_SRC}/${file}`), ['seofiles']);
  gulp.watch(`${FOLDER_SRC}/**/*.+(css|html)`, ['compile']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/*/*`, ['assets']);
  gulp.watch(`${FOLDER_SRC_ASSETS}/json/*`, ['compile']);
  gulp.watch(`${FOLDER_DIST}/index.html`, ['amp:validate']);
});

