const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
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
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
    new SetSwcTargetPlugin(),
  ],
};
