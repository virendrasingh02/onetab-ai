import Prism from 'prismjs';

/**
 * Loads the curated Prism grammars, once.
 *
 * Prism's component files are plain scripts written for a `<script>`-tag
 * world — each one (see e.g. `prism-markup.js`) references a bare `Prism`
 * global and exports nothing. They cannot be static imports: imports are
 * hoisted above any code that sets the global, and Rolldown is free to move
 * side-effect-only modules into a shared chunk that runs even earlier (the
 * Studio production build did exactly that and crashed on load with
 * "Prism is not defined"). Dynamic imports run only when awaited, so the
 * global is guaranteed to exist first.
 *
 * Loaded in the order Prism's components require (markup before jsx/markdown,
 * javascript before typescript/jsx, ...).
 */
let loading: Promise<typeof Prism> | null = null;

export function loadPrism(): Promise<typeof Prism> {
  loading ??= (async () => {
    (globalThis as { Prism?: typeof Prism }).Prism = Prism;
    await import('prismjs/components/prism-markup.js');
    await import('prismjs/components/prism-css.js');
    await import('prismjs/components/prism-javascript.js');
    await import('prismjs/components/prism-typescript.js');
    await import('prismjs/components/prism-jsx.js');
    await import('prismjs/components/prism-tsx.js');
    await import('prismjs/components/prism-python.js');
    await import('prismjs/components/prism-json.js');
    await import('prismjs/components/prism-yaml.js');
    await import('prismjs/components/prism-bash.js');
    await import('prismjs/components/prism-sql.js');
    await import('prismjs/components/prism-diff.js');
    await import('prismjs/components/prism-markdown.js');
    return Prism;
  })();
  return loading;
}

export default Prism;
