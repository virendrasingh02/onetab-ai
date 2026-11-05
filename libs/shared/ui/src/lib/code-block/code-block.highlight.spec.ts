import { describe, expect, it } from 'vitest';
import { CORE_SHIKI_LANGUAGES } from './code-block.constants.js';
import { getHighlighter, highlightCodeToTokens } from './code-block.utils.js';

const SAMPLES: Record<(typeof CORE_SHIKI_LANGUAGES)[number], string> = {
  javascript: 'const answer = 42;',
  jsx: 'const a = <div className="x">hi</div>;',
  typescript: 'const answer: number = 42;',
  tsx: 'const a: JSX.Element = <div>hi</div>;',
  json: '{"a": 1}',
  jsonc: '{"a": 1 /* note */}',
  bash: 'echo "$HOME"',
  python: 'def main():\n    return 42',
  html: '<div class="x">hi</div>',
  css: '.x { color: red; }',
  markdown: '# Title\n\n**bold**',
  sql: 'SELECT id FROM users;',
  yaml: 'a: 1\nb: two',
  diff: '- old\n+ new',
};

/** Plain-text fallback is one uncoloured token per line. */
const isHighlighted = (
  tokens: Awaited<ReturnType<typeof highlightCodeToTokens>>,
) => !!tokens?.flat().some((token) => token.htmlStyle || token.color);

describe('Shiki highlighting', () => {
  it.each(CORE_SHIKI_LANGUAGES)(
    'highlights the core language %s',
    async (lang) => {
      expect(
        isHighlighted(await highlightCodeToTokens(SAMPLES[lang], lang)),
      ).toBe(true);
    },
  );

  it('carries both themes on each token', async () => {
    const tokens = await highlightCodeToTokens('const a = 1;', 'typescript');
    const styled = tokens?.flat().find((token) => token.htmlStyle);
    expect(JSON.stringify(styled?.htmlStyle)).toContain('--shiki-dark');
  });

  it('loads a non-core language on demand, through its alias too', async () => {
    const before = (await getHighlighter())?.getLoadedLanguages() ?? [];
    expect(before).not.toContain('rust');
    const tokens = await highlightCodeToTokens('fn main() {}', 'rs');
    expect(isHighlighted(tokens)).toBe(true);
    expect((await getHighlighter())?.getLoadedLanguages()).toContain('rust');
  });

  it('loads a language outside the app list, as the full bundle did', async () => {
    expect(
      isHighlighted(
        await highlightCodeToTokens('main = putStrLn "hi"', 'haskell'),
      ),
    ).toBe(true);
  });

  it('does not load anything beyond the core and what was asked for', async () => {
    const loaded = (await getHighlighter())?.getLoadedLanguages() ?? [];
    expect(loaded).not.toContain('cobol');
    expect(loaded.length).toBeLessThan(60);
  });

  it('falls back to plain text for an unknown language', async () => {
    expect(await highlightCodeToTokens('hello', 'not-a-language')).toEqual([
      [{ content: 'hello' }],
    ]);
  });

  it('shares one highlighter across concurrent first requests', async () => {
    const [first, second] = await Promise.all([
      getHighlighter(),
      getHighlighter(),
    ]);
    expect(first).toBe(second);
  });

  it('highlights concurrent blocks of one new language', async () => {
    const results = await Promise.all([
      highlightCodeToTokens('package main', 'go'),
      highlightCodeToTokens('package main\nfunc a() {}', 'golang'),
    ]);
    expect(results.every(isHighlighted)).toBe(true);
  });
});
