import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Builds the popup and the background service worker.
 *
 * Content scripts are *not* built here — they are ES modules after bundling,
 * and MV3 content scripts have no module loader, so an `import` at the top of
 * one is a runtime error in the page. They get their own IIFE build in
 * `vite.content.config.mts`, which this config's `build` target runs after.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/extension',
  // Chrome loads everything from the extension root, so assets must be
  // referenced relatively rather than from an absolute `/`.
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(import.meta.dirname, '../../node_modules/react'),
      'react-dom': path.resolve(
        import.meta.dirname,
        '../../node_modules/react-dom',
      ),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      // The manifest is the one file Chrome reads before anything else, and it
      // is hand-maintained rather than generated, so it is copied verbatim.
      name: 'onetab-copy-manifest',
      apply: 'build',
      closeBundle() {
        const outDir = path.resolve(import.meta.dirname, 'dist');
        mkdirSync(outDir, { recursive: true });
        copyFileSync(
          path.resolve(import.meta.dirname, 'manifest.json'),
          path.join(outDir, 'manifest.json'),
        );
      },
    },
  ],
  build: {
    outDir: './dist',
    // The content build runs second and must not wipe this one's output.
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        // `popup.html` sits at the app root, not in `src/`: Vite emits HTML
        // entries at their path relative to the project root, so a file under
        // `src/` would land at `dist/src/popup.html` and the manifest's
        // `default_popup` would not resolve.
        popup: path.resolve(import.meta.dirname, 'popup.html'),
        background: path.resolve(import.meta.dirname, 'src/background.ts'),
      },
      output: {
        // The manifest names `background.js` at the extension root, so the
        // entry cannot carry a content hash or a subdirectory.
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
