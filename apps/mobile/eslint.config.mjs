import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/out-tsc',
      '**/dist',
      '**/.expo',
      '**/android',
      '**/ios',
      'src/expo-env.d.ts',
    ],
  },
  {
    // Expo/Metro config files are CommonJS by convention.
    files: ['metro.config.js', 'babel.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
