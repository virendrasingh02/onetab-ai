/**
 * Conventional Commits, with a scope list mirroring the workspace layout.
 * `nx affected` keys off commit ranges, so consistent history is worth enforcing.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'web',
        'admin',
        'api',
        'auth',
        'workspace',
        'channel',
        'member',
        'invitation',
        'profile',
        'settings',
        'dashboard',
        'layout',
        'search',
        'theme',
        'upload',
        'notifications',
        'ui',
        'design-system',
        'types',
        'utils',
        'validation',
        'config',
        'constants',
        'hooks',
        'api-client',
        'realtime',
        'database',
        'deps',
        'ci',
        'repo',
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
};
