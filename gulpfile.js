var gulp = require('gulp');
var babel = require('gulp-babel');
var rollup = require('gulp-rollup');
var merge = require('merge-stream')
var rollupTypescript = require('rollup-plugin-typescript');
var rollupTerser = require('@rollup/plugin-terser');

function buildScript(filepath) {
  return gulp.src('src/scripts/**/*.ts')
    .pipe(rollup({
      input: filepath,
      output: {
        format: 'cjs'
      },
      plugins: [
        rollupTypescript(),
        // rollupTerser()
      ]
    }))
    .pipe(babel({
      presets: [
        "@babel/preset-env",
        /*["babel-preset-minify", {
          builtIns: false,
        }]*/
      ]
    }))
    .pipe(gulp.dest('./static/scripts'))
}

gulp.task('build', () => {
  return merge(...[
    'src/scripts/app.ts'
  ].map(filepath => buildScript(filepath)))
});

gulp.task('watch', () => {
  gulp.watch('src/scripts/**/*.ts', gulp.series(['build']));
});

gulp.task('start', gulp.series(['build', 'watch']));
