module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // `@org/api-client` reads `import.meta.env` for the Vite apps; Hermes
          // has no `import.meta`, so let the preset rewrite it.
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
