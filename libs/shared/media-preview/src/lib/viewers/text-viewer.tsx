import { Button, ErrorState, LoadingState, ScrollArea, toast } from '@org/ui';
import { cn } from '@org/utils';
import { Copy, WrapText } from 'lucide-react';
// Grammars load on demand (see prism-loader.ts). This whole module is only
// ever reached via the `React.lazy()` boundary in `media-preview-content.tsx`,
// so none of this — Prism core included — is in the app's main bundle.
import Prism, { loadPrism } from './prism-loader.js';
import { useEffect, useMemo, useState } from 'react';
import type { MediaItem } from '../types.js';
import './prism-theme.css';

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
};

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
  md: 'markdown',
  markdown: 'markdown',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
};

function extensionOf(name: string): string | undefined {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? undefined : name.slice(dot + 1).toLowerCase();
}

function resolveLanguage(item: MediaItem): string | undefined {
  const declared = item.language?.toLowerCase();
  const normalized = declared
    ? (LANGUAGE_ALIASES[declared] ?? declared)
    : undefined;
  if (normalized && Prism.languages[normalized]) return normalized;

  const ext = extensionOf(item.name);
  const fromExtension = ext ? EXTENSION_TO_LANGUAGE[ext] : undefined;
  return fromExtension && Prism.languages[fromExtension]
    ? fromExtension
    : undefined;
}

function diffLineClass(line: string): string | undefined {
  if (line.startsWith('+++') || line.startsWith('---')) return undefined;
  if (line.startsWith('+')) return 'bg-success/10 text-success-text';
  if (line.startsWith('-'))
    return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (line.startsWith('@@')) return 'text-primary font-medium';
  return undefined;
}

export interface TextViewerProps {
  item: MediaItem;
  url?: string;
}

export function TextViewer({ item, url }: TextViewerProps) {
  const [content, setContent] = useState<string | undefined>(item.inlineText);
  const [error, setError] = useState<string>();
  const [wrap, setWrap] = useState(false);
  const [grammarsReady, setGrammarsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A grammar that fails to load just leaves the file as plain text.
    loadPrism()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setGrammarsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (item.inlineText !== undefined || !url) return;
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load file');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load file');
      });
    return () => {
      cancelled = true;
    };
  }, [url, item.inlineText]);

  const language = useMemo(
    () => (grammarsReady ? resolveLanguage(item) : undefined),
    [item, grammarsReady],
  );
  const lines = useMemo(() => (content ?? '').split('\n'), [content]);

  const copy = async () => {
    if (content === undefined) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (error) {
    return (
      <ErrorState
        fullPage
        title="Preview unavailable"
        description={error}
        className="text-popover-foreground"
      />
    );
  }

  if (content === undefined) {
    return (
      <LoadingState
        fullPage
        label="Loading file…"
        className="text-popover-foreground"
      />
    );
  }

  const grammar = language ? Prism.languages[language] : undefined;

  return (
    <div className="flex size-full flex-col bg-surface text-foreground">
      <div className="gap-1 px-3 py-2 flex shrink-0 items-center justify-end border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWrap((value) => !value)}
          leadingIcon={<WrapText />}
        >
          {wrap ? 'No wrap' : 'Wrap'}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy} leadingIcon={<Copy />}>
          Copy
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <pre className="p-4 leading-6 font-mono text-[13px]">
          <code>
            {lines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  'gap-4 px-1 flex',
                  item.isDiff && diffLineClass(line),
                )}
              >
                <span className="w-10 shrink-0 text-right text-muted-foreground/50 tabular-nums select-none">
                  {index + 1}
                </span>
                {grammar ? (
                  <span
                    className={cn(
                      wrap
                        ? 'break-words whitespace-pre-wrap'
                        : 'whitespace-pre',
                    )}
                    // Safe: Prism.highlight() HTML-escapes the source text as
                    // part of tokenizing it, then wraps recognised tokens in
                    // <span class="token ...">. The output is never the raw
                    // file content passed through unescaped — this is the
                    // standard way every Prism-based viewer renders its
                    // output (there is no non-dangerouslySetInnerHTML API for
                    // it), not a shortcut around sanitisation.
                    dangerouslySetInnerHTML={{
                      __html: Prism.highlight(
                        line.length ? line : ' ',
                        grammar,
                        language as string,
                      ),
                    }}
                  />
                ) : (
                  <span
                    className={cn(
                      wrap
                        ? 'break-words whitespace-pre-wrap'
                        : 'whitespace-pre',
                    )}
                  >
                    {line.length ? line : ' '}
                  </span>
                )}
              </div>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  );
}
