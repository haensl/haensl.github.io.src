const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const browserSync = require('browser-sync');

const FOLDER_DIST = 'dist';
const FOLDER_DIST_ASSETS = `${FOLDER_DIST}/assets`;
const FOLDER_SRC = 'src';
const DIRECTIVE_CSS_INCLUDE = '<!-- INCLUDE_CSS -->';
const OPTS_HTMLMIN = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true
};

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

gulp.task('clean:dist', ['ensureDistFolderExists'], () =>
  del([`${FOLDER_DIST}/*`], {
    force: true
  }));

gulp.task('clean:css', ['ensureDistFolderExists'], () =>
  del([`${FOLDER_DIST}/*.css`], {
    force: true
  }));

gulp.task('clean:html', ['ensureDistFolderExists'], () =>
  del([`${FOLDER_DIST}/*.html`], {
    force: true
  }));

gulp.task('clean:assets', ['ensureDistAssetsFolderExists'], () =>
  del([`${FOLDER_DIST}/assets/*`], {
    force: true
  }));


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
  gulp.src(`${FOLDER_SRC}/index.html`)
    .pipe($.replace(DIRECTIVE_CSS_INCLUDE, (match) => `<style amp-custom>${ fs.readFileSync(path.join(FOLDER_DIST, 'style.tmp.css'))}</style>`))
    .pipe($.htmlmin(OPTS_HTMLMIN))
    .pipe(gulp.dest(FOLDER_DIST)));

gulp.task('compile', ['css', 'html'], () => {
  del(path.join(FOLDER_DIST, 'style.tmp.css'));
  browserSync.reload();
});

gulp.task('assets', ['clean:assets'], () =>
  gulp.src(`${FOLDER_SRC}/assets/**/*`)
    .pipe(gulp.dest(FOLDER_DIST_ASSETS)));

gulp.task('default', ['compile', 'assets'], () => {
  browserSync({
    server: FOLDER_DIST
  });

  gulp.watch(`${FOLDER_SRC}/**/*.+(css|html)`, ['compile']);
  gulp.watch(`${FOLDER_SRC}/assets/**/*`, ['assets']);
});

