import * as pdfjsLib from 'pdfjs-dist';

/*
 * Points pdf.js at its worker script. `new URL(..., import.meta.url)` is the
 * standard, bundler-native way to do this and is what Vite/Rollup resolve
 * into a real emitted asset URL — no plugin required.
 *
 * If a future Vite/Rolldown upgrade regresses this (there are reports of it
 * breaking in some configs from Vite >=7.1 onward), the fallback chain, in
 * order, is:
 *   1. `import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';`
 *      then `GlobalWorkerOptions.workerSrc = pdfWorkerUrl;`
 *   2. Copy the worker file to `apps/web/public/pdf.worker.min.mjs` and set
 *      `workerSrc = '/pdf.worker.min.mjs'` — guaranteed bundler-independent.
 * Verify against both `nx dev web` and `nx build web && nx preview web`
 * before relying on any of these — the dev server and the production build
 * can disagree here.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export { pdfjsLib };
export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist';
