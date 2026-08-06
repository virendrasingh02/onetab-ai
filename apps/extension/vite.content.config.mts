import { defineConfig } from 'vite';
import path from 'node:path';

/**
 * Builds one content script, selected with `--mode <name>`.
 *
 * Separate from `vite.config.mts` because MV3 content scripts are injected as
 * classic scripts — there is no module loader in that context, so an `import`
 * surviving into the output throws in the page. Each script is bundled
 * standalone as an IIFE with everything inlined.
 *
 * One entry per invocation, because a bundler cannot emit several IIFEs from a
 * single pass: an IIFE has no export mechanism, so shared code cannot be split
 * into a chunk, and `inlineDynamicImports` — which forces everything into one
 * file — is rejected outright when there is more than one input.
 *
 * `--mode` carries the entry name rather than an environment variable so the
 * command is identical on every platform; `CONTENT_ENTRY=x vite build` is not
 * valid syntax in PowerShell.
 */
const ENTRIES = {
  'ai-anywhere': 'src/content/ai-anywhere.ts',
  'session-bridge': 'src/content/session-bridge.ts',
} as const;

type EntryName = keyof typeof ENTRIES;

export default defineConfig(({ mode }) => {
  if (!(mode in ENTRIES)) {
    throw new Error(
      `Pass --mode <entry>, one of: ${Object.keys(ENTRIES).join(', ')}`,
    );
  }
  const entry = mode as EntryName;

  return {
    root: import.meta.dirname,
    cacheDir: `../../node_modules/.vite/extension-${entry}`,
    // The popup build already copies `public/` to the extension root. Left on,
    // this would copy it a second time into `dist/content/`, shipping a
    // duplicate set of icons that nothing references.
    publicDir: false,
    build: {
      outDir: './dist/content',
      // The popup build owns clearing `dist`; this one appends to it.
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      reportCompressedSize: false,
      rollupOptions: {
        input: path.resolve(import.meta.dirname, ENTRIES[entry]),
        output: {
          format: 'iife' as const,
          entryFileNames: `${entry}.js`,
          inlineDynamicImports: true,
        },
      },
    },
  };
});
