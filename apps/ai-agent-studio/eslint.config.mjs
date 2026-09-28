import baseConfig from '../../eslint.config.mjs';

/*
 * The root config already covers React + hooks for the whole workspace. Nx's
 * `flat/react` preset is deliberately not spread in: its eslint-plugin-react
 * rules crash under ESLint 10 (`contextOrFilename.getFilename is not a
 * function`), which took this project's lint down entirely.
 */
export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc', '**/dist'],
  },
];
