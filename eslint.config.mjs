import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Workspace ESLint configuration (flat config).
 *
 * Architectural rules live in `@nx/enforce-module-boundaries` below. Every
 * project declares `nx.tags` in its `package.json`; the constraints here turn
 * those tags into build-breaking rules.
 *
 * Tag taxonomy
 *   scope:*  who owns the code   — web | admin | api | shared
 *   type:*   what the code is    — app | e2e | feature | ui | data-access | util | types
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist',
      // electron-builder output: installers plus a copy of the built web bundle.
      'apps/desktop/release',
      '**/out-tsc',
      '**/coverage',
      '**/test-output',
      '**/node_modules',
      '**/.nx',
      '**/vite.config.*.timestamp*',
      '**/generated/**',
      'apps/api/webpack.config.js',
      // Static assets served as-is; the emoji dataset is copied in by
      // scripts/sync-emojibase.mjs (see apps/web/vite.config.mts).
      'apps/*/public/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // --- ownership -------------------------------------------------
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'],
            },
            {
              sourceTag: 'scope:admin',
              onlyDependOnLibsWithTags: ['scope:admin', 'scope:shared'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },

            // --- layering --------------------------------------------------
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['*'] },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: ['*'] },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:util',
                'type:types',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:types'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:util',
                'type:types',
              ],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:types'],
            },
            {
              sourceTag: 'type:types',
              onlyDependOnLibsWithTags: ['type:types'],
            },
          ],
        },
      ],
    },
  },

  // --- TypeScript -----------------------------------------------------------
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },

  // --- React ----------------------------------------------------------------
  {
    // `.ts` as well as `.tsx`: custom hooks routinely live in plain .ts
    // modules, and the rules (and their disable comments) must resolve there.
    files: ['**/*.tsx', '**/*.jsx', '**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // --- NestJS ---------------------------------------------------------------
  {
    files: ['apps/api/**/*.ts', 'libs/api/**/*.ts'],
    rules: {
      // Nest DI relies on parameter decorators and empty constructors.
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-console': 'off',
      // `emitDecoratorMetadata` resolves constructor-injected providers from
      // the *runtime* import. Rewriting these to `import type` erases the
      // metadata and breaks dependency injection at runtime.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // --- Tests ----------------------------------------------------------------
  {
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/src/support/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // --- Maintenance scripts --------------------------------------------------
  {
    files: ['scripts/**/*.{ts,mts,mjs}'],
    rules: {
      // Their output *is* the interface: they are run by hand from a terminal.
      'no-console': 'off',
    },
  },

  // --- Config files ---------------------------------------------------------
  {
    files: ['**/*.config.{js,cjs,mjs,ts,mts}', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
