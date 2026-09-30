import {
  DEFAULT_THEMES,
  LANGUAGE_ALIASES,
  LANGUAGE_EXTENSIONS,
  LANGUAGE_MIME_TYPES,
  LANGUAGE_NAMES,
  CORE_SHIKI_LANGUAGES,
} from './code-block.constants.js';
import type { DiffLine, DiffResult, HighlightedToken } from './types.js';

/**
 * Normalizes user-specified or parsed language identifier to standard canonical form.
 */
export function normalizeLanguage(raw?: string): string {
  if (!raw) return 'plaintext';
  const clean = raw.trim().toLowerCase();
  return LANGUAGE_ALIASES[clean] || clean;
}

/**
 * Returns human-readable display name for language.
 */
export function getLanguageName(lang?: string): string {
  const normalized = normalizeLanguage(lang);
  return LANGUAGE_NAMES[normalized] || normalized.toUpperCase();
}

/**
 * Returns default file extension for language.
 */
export function getLanguageExtension(lang?: string): string {
  const normalized = normalizeLanguage(lang);
  return LANGUAGE_EXTENSIONS[normalized] || 'txt';
}

/**
 * Returns MIME type for downloading code.
 */
export function getLanguageMimeType(lang?: string): string {
  const normalized = normalizeLanguage(lang);
  return LANGUAGE_MIME_TYPES[normalized] || 'text/plain';
}

/**
 * Lightweight heuristic language detection when no language is specified.
 */
export function detectLanguage(code: string): string {
  if (!code) return 'plaintext';
  const trimmed = code.trim();

  // JSON
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid json, continue heuristics
    }
  }

  // HTML / XML / SVG
  if (/^<(!DOCTYPE\s+html|[a-z][\w-]*(\s+[^>]*)?>)/i.test(trimmed)) {
    return trimmed.includes('<svg') ? 'xml' : 'html';
  }

  // SQL
  if (
    /^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(
      trimmed,
    )
  ) {
    return 'sql';
  }

  // TypeScript / JavaScript / JSX / TSX
  if (
    /^(import\s+.*?from\s+['"].*?['"]|export\s+(default|const|let|var|function|class|interface|type)|const\s+\w+\s*=\s*|let\s+\w+\s*=\s*|function\s+\w+\s*\(|interface\s+\w+\s*\{|type\s+\w+\s*=)/m.test(
      trimmed,
    )
  ) {
    if (/\b(interface|type\s+\w+\s*=|:\s*(string|number|boolean|any|void))\b/.test(trimmed)) {
      return trimmed.includes('</') || trimmed.includes('/>') ? 'tsx' : 'typescript';
    }
    return trimmed.includes('</') || trimmed.includes('/>') ? 'jsx' : 'javascript';
  }

  // Python
  if (
    /^(import\s+[\w.]+|from\s+[\w.]+\s+import|def\s+\w+\s*\(|class\s+\w+(\(.*?\))?:|if\s+__name__\s*==\s*['"]__main__['"]:)/m.test(
      trimmed,
    )
  ) {
    return 'python';
  }

  // Bash / Shell
  if (
    trimmed.startsWith('#!/bin/') ||
    trimmed.startsWith('$ ') ||
    /^(npm|pnpm|yarn|bun|curl|git|docker|npx|brew|echo)\s+/m.test(trimmed) ||
    /^export\s+[A-Za-z0-9_]+=/m.test(trimmed)
  ) {
    return 'bash';
  }

  // YAML
  if (/^([a-zA-Z0-9_-]+:\s*.+(\n\s+-[^\n]+|\n[a-zA-Z0-9_-]+:)*)/m.test(trimmed)) {
    return 'yaml';
  }

  return 'plaintext';
}

/**
 * Parses line numbers or range specifications into a Set of 1-based line numbers.
 * Supports numbers array [1, 2, 5] or string "1, 3-5, 8".
 */
export function parseHighlightedLines(input?: number[] | string): Set<number> {
  const result = new Set<number>();
  if (!input) return result;

  if (Array.isArray(input)) {
    for (const num of input) {
      if (typeof num === 'number' && Number.isInteger(num)) {
        result.add(num);
      }
    }
    return result;
  }

  if (typeof input === 'string') {
    const parts = input.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            result.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
          result.add(num);
        }
      }
    }
  }

  return result;
}

/**
 * Sanitizes and generates safe filename with proper extension.
 */
export function sanitizeFilename(filename?: string, language?: string): string {
  const ext = getLanguageExtension(language);
  if (!filename || !filename.trim()) {
    return `snippet.${ext}`;
  }

  // Remove directory traversal characters and control characters
  let clean = filename
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .trim();

  if (!clean) {
    clean = `snippet`;
  }

  // Ensure file has an extension
  if (!clean.includes('.')) {
    clean = `${clean}.${ext}`;
  }

  return clean;
}

/**
 * Copies plain text to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // Fallback for older browsers or restricted iframe environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Triggers a client-side file download.
 */
export function downloadAsFile(content: string, filename: string, mimeType?: string): void {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 150);
}

/**
 * Computes line-by-line diff between original and modified code.
 */
export function computeDiff(originalCode = '', modifiedCode = ''): DiffResult {
  const originalLines = originalCode.split('\n');
  const modifiedLines = modifiedCode.split('\n');

  // Simple LCS-based line differ
  const n = originalLines.length;
  const m = modifiedLines.length;

  // Build LCS matrix
  const matrix: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (originalLines[i] === modifiedLines[j]) {
        matrix[i + 1][j + 1] = matrix[i][j] + 1;
      } else {
        matrix[i + 1][j + 1] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  // Backtrack to assemble diff
  const diffLines: DiffLine[] = [];
  let i = n;
  let j = m;
  let addedCount = 0;
  let removedCount = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      diffLines.unshift({
        type: 'unchanged',
        oldLineNumber: i,
        newLineNumber: j,
        content: originalLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diffLines.unshift({
        type: 'added',
        newLineNumber: j,
        content: modifiedLines[j - 1],
      });
      addedCount++;
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diffLines.unshift({
        type: 'removed',
        oldLineNumber: i,
        content: originalLines[i - 1],
      });
      removedCount++;
      i--;
    }
  }

  return {
    lines: diffLines,
    addedCount,
    removedCount,
  };
}

// ---------------------------------------------------------------------------
// Shiki Highlighter Singleton Manager
// ---------------------------------------------------------------------------

type ShikiHighlighter = any;

let highlighterPromise: Promise<ShikiHighlighter | null> | null = null;
const loadedLanguages = new Set<string>();
const tokenCache = new Map<string, HighlightedToken[][]>();

/**
 * Initializes and returns the shared Shiki highlighter instance.
 */
export async function getHighlighter(): Promise<ShikiHighlighter | null> {
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    try {
      const shiki = await import('shiki');
      const highlighter = await shiki.createHighlighter({
        themes: [DEFAULT_THEMES.light, DEFAULT_THEMES.dark],
        langs: [...CORE_SHIKI_LANGUAGES],
      });

      for (const lang of CORE_SHIKI_LANGUAGES) {
        loadedLanguages.add(lang);
      }

      return highlighter;
    } catch (err) {
      console.warn('Failed to initialize Shiki syntax highlighter, falling back to plain text:', err);
      return null;
    }
  })();

  return highlighterPromise;
}

/**
 * Highlights source code using Shiki into token lines.
 * Returns null if highlighter is not ready or failed, allowing plain text fallback.
 */
export async function highlightCodeToTokens(
  code: string,
  lang: string,
): Promise<HighlightedToken[][] | null> {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'plaintext') {
    return plainTextToTokens(code);
  }

  const cacheKey = `${normalized}::${code}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  try {
    const highlighter = await getHighlighter();
    if (!highlighter) return plainTextToTokens(code);

    // Lazy load language if not already loaded
    if (!loadedLanguages.has(normalized)) {
      try {
        await highlighter.loadLanguage(normalized);
        loadedLanguages.add(normalized);
      } catch {
        // Unknown or unsupported language in Shiki, fall back
        return plainTextToTokens(code);
      }
    }

    const result = highlighter.codeToTokens(code, {
      lang: normalized,
      themes: {
        light: DEFAULT_THEMES.light,
        dark: DEFAULT_THEMES.dark,
      },
    });

    const tokens: HighlightedToken[][] = result.tokens.map((line: any[]) =>
      line.map((t: any) => ({
        content: t.content,
        htmlStyle: t.htmlStyle,
        color: t.color,
      })),
    );

    // Cache bounded to 500 entries to prevent memory leak
    if (tokenCache.size > 500) {
      const firstKey = tokenCache.keys().next().value;
      if (firstKey) tokenCache.delete(firstKey);
    }
    tokenCache.set(cacheKey, tokens);

    return tokens;
  } catch (err) {
    console.warn(`Syntax highlighting failed for language "${lang}":`, err);
    return plainTextToTokens(code);
  }
}

/**
 * Turns plain text into token structure for fast fallback rendering.
 */
export function plainTextToTokens(code: string): HighlightedToken[][] {
  const lines = code.split('\n');
  return lines.map((line) => [{ content: line }]);
}
