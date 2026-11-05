const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { join } = require('path');

/**
 * `@nx/webpack` configures swc-loader without a `jsc.target`, so SWC falls back
 * to ES5. That downlevels `class PrismaService extends PrismaClient` into an
 * `_inherits` shim, and calling a native ES2015 base class that way throws
 * "Class constructor cannot be invoked without 'new'" at boot.
 *
 * This plugin runs after Nx's and raises the target. Node 22+ needs no
 * downleveling at all.
 */
class SetSwcTargetPlugin {
  apply(compiler) {
    for (const rule of compiler.options.module?.rules ?? []) {
      if (typeof rule !== 'object' || !rule?.loader?.includes('swc-loader')) {
        continue;
      }
      rule.options = {
        ...rule.options,
        jsc: {
          ...rule.options?.jsc,
          target: 'es2022',
          // `loose: true` also breaks class-field semantics Nest relies on.
          loose: false,
          keepClassNames: true,
        },
      };
    }
  }
}

/**
 * Replaces Nx's minimizer, which turns mangling off entirely. Local names are
 * safe to shorten; class and function names are not: Nest reads them for logger
 * contexts, Swagger schemas and error names (`this.constructor.name`), so both
 * are kept. Property names are never mangled, which keeps route handlers and
 * reflection metadata intact.
 */
class ApiMinimizerPlugin {
  apply(compiler) {
    const keepNames = { keep_classnames: true, keep_fnames: true };
    compiler.options.optimization.minimizer = [
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        extractComments: false,
        terserOptions: {
          compress: keepNames,
          mangle: keepNames,
          format: { comments: false },
        },
      }),
    ];
  }
}

const isProduction = process.env.NODE_ENV === 'production';

/** Dev keeps full maps. Production has none unless asked, and then unreferenced. */
function sourceMapSetting() {
  if (!isProduction) return true;
  return process.env.GENERATE_SOURCEMAP === 'true'
    ? 'hidden-source-map'
    : false;
}

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  resolve: {
    /**
     * Workspace libraries and the generated Prisma client use explicit `.js`
     * specifiers (required by `moduleResolution: nodenext`) while shipping
     * `.ts` sources. TypeScript understands that mapping; webpack does not
     * unless it is spelled out here.
     */
    extensionAlias: {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      /**
       * SWC rather than tsc: ts-loader compiles the app and every workspace
       * library it imports as one flat program, which trips TS6059 because the
       * libraries sit outside this project. Types are still checked — by the
       * `typecheck` target, which uses TS project references properly.
       */
      compiler: 'swc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      // Nx's own flag (boolean or { scripts, styles }), not webpack's `optimization`.
      optimization: isProduction,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: sourceMapSetting(),
    }),
    new SetSwcTargetPlugin(),
    ...(isProduction ? [new ApiMinimizerPlugin()] : []),
  ],
};
