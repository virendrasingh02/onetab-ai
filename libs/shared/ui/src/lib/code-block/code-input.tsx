import { cn } from '@org/utils';
import { Check, Code2, Copy } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/button.js';
import {
  copyToClipboard,
  getLanguageName,
  highlightCodeToTokens,
  normalizeLanguage,
} from './code-block.utils.js';
import type { HighlightedToken } from './types.js';

export interface CodeInputProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'onChange' | 'rows' | 'wrap'
  > {
  value: string;
  /** Receives the new code string (not the change event). */
  onChange?: (value: string) => void;
  /** Shiki language id or alias (`js`, `python`, `sql`, `json`, `html`…). */
  language?: string;
  /** Header label; defaults to the language's display name. */
  title?: string;
  /** Minimum visible lines (default 6). */
  minRows?: number;
  /** Lines before the editor scrolls instead of growing (default 20). */
  maxRows?: number;
  /** Fill the parent's height (flex column) instead of sizing by rows. */
  fill?: boolean;
  showLineNumbers?: boolean;
  showHeader?: boolean;
  showCopy?: boolean;
  /** Extra header controls (e.g. a Format button), rendered before Copy. */
  actions?: React.ReactNode;
  invalid?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
  textareaClassName?: string;
}

const LINE_HEIGHT_PX = 20; // keep in sync with `leading-5`
const PAD_Y_PX = 8; // keep in sync with `py-2`
const INDENT = '  ';

/**
 * Editable code field: a transparent `<textarea>` stacked over a Shiki
 * highlighted `<pre>` in one grid cell, inside a single scroll container, so
 * caret, selection and colours stay aligned without any scroll syncing.
 * Visually matches the read-only `CodeBlock` frame.
 */
export function CodeInput({
  value,
  onChange,
  language = 'plaintext',
  title,
  minRows = 6,
  maxRows = 20,
  fill = false,
  showLineNumbers = true,
  showHeader = true,
  showCopy = true,
  actions,
  invalid,
  disabled,
  readOnly,
  className,
  textareaClassName,
  onKeyDown,
  ref,
  ...textareaProps
}: CodeInputProps) {
  const lang = normalizeLanguage(language);
  const code = value ?? '';
  const lines = useMemo(() => code.split('\n'), [code]);
  const [highlight, setHighlight] = useState<{
    lines: string[];
    tokens: HighlightedToken[][];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  // Tab indents; Esc releases it so keyboard users can still Tab out.
  const tabReleased = useRef(false);

  useEffect(() => {
    if (lang === 'plaintext') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const tokens = await highlightCodeToTokens(code, lang).catch(() => null);
      if (!cancelled && tokens) setHighlight({ lines: code.split('\n'), tokens });
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, lang]);

  // Reuse highlighted tokens for every line whose text is unchanged since the
  // last highlight pass; only freshly edited lines render plain until the
  // debounced pass catches up, so typing never flickers the whole block.
  const renderedLines = useMemo(() => {
    const byText = new Map<string, HighlightedToken[]>();
    highlight?.lines.forEach((text, i) => {
      if (highlight.tokens[i]) byText.set(text, highlight.tokens[i]);
    });
    return lines.map((text, i) => {
      if (highlight && highlight.lines[i] === text && highlight.tokens[i]) {
        return highlight.tokens[i];
      }
      return byText.get(text) ?? null;
    });
  }, [lines, highlight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || readOnly || disabled) return;
    const el = e.currentTarget;

    if (e.key === 'Escape') {
      tabReleased.current = true;
      return;
    }
    if (e.key !== 'Tab') tabReleased.current = false;

    if (e.key === 'Tab' && !tabReleased.current && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const { selectionStart: start, selectionEnd: end } = el;
      const lineStart = code.lastIndexOf('\n', start - 1) + 1;
      if (e.shiftKey) {
        const removable = code.slice(lineStart, lineStart + INDENT.length).match(/^ {1,2}/)?.[0];
        if (!removable) return;
        el.setSelectionRange(lineStart, lineStart + removable.length);
        insertText(el, '');
        el.setSelectionRange(
          Math.max(lineStart, start - removable.length),
          Math.max(lineStart, end - removable.length),
        );
      } else {
        insertText(el, INDENT);
      }
      return;
    }

    // Enter keeps the current line's indentation.
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const lineStart = code.lastIndexOf('\n', el.selectionStart - 1) + 1;
      const indent = code.slice(lineStart).match(/^[ \t]*/)?.[0] ?? '';
      if (indent) {
        e.preventDefault();
        insertText(el, '\n' + indent);
      }
    }
  };

  const handleCopy = async () => {
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const gutterCh = Math.max(String(lines.length).length, 2) + 2;
  const scrollStyle: React.CSSProperties | undefined = fill
    ? undefined
    : {
        minHeight: minRows * LINE_HEIGHT_PX + PAD_Y_PX * 2,
        maxHeight: maxRows * LINE_HEIGHT_PX + PAD_Y_PX * 2,
      };
  const textClass = 'm-0 py-2 px-3 font-mono text-xs leading-5 whitespace-pre [tab-size:2]';

  return (
    <div
      data-slot="code-input"
      aria-invalid={invalid || undefined}
      className={cn(
        'group/code flex w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-surface-inset shadow-xs',
        'transition-[border-color,box-shadow] duration-(--duration-fast)',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
        invalid && 'border-destructive ring-2 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20',
        disabled && 'opacity-70',
        fill && 'min-h-0 flex-1',
        className,
      )}
    >
      {showHeader && (
        <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-surface-raised/80 px-3 select-none">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Code2 className="size-3.5 shrink-0" />
            <span className="truncate font-mono text-[11px] font-medium tracking-wide">
              {title ?? getLanguageName(lang)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {showCopy && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                disabled={!code}
                className={cn(
                  'size-6',
                  copied ? 'text-success-text' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label={copied ? 'Copied' : 'Copy code'}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className={cn('relative flex overflow-auto scrollbar-subtle', fill && 'min-h-0 flex-1')}
        style={scrollStyle}
      >
        {showLineNumbers && (
          <div
            aria-hidden="true"
            className="sticky left-0 z-10 shrink-0 self-stretch border-r border-border/50 bg-surface-raised/60 py-2 pr-2 text-right font-mono text-[11px] leading-5 text-muted-foreground/50 select-none backdrop-blur-xs"
            style={{ width: `${gutterCh + 1}ch` }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}

        <div className="grid min-w-0 flex-1 [grid-template-areas:'stack'] *:[grid-area:stack]">
          <pre aria-hidden="true" className={cn(textClass, 'pointer-events-none text-foreground')}>
            {lines.map((text, i) => {
              const tokens = renderedLines[i];
              return (
              <div key={i} className="min-h-5">
                {tokens
                  ? tokens.map((token, t) => (
                      <span
                        key={t}
                        style={{ color: token.htmlStyle?.color || token.color, ...(token.htmlStyle as React.CSSProperties) }}
                        className={cn(token.htmlStyle?.['--shiki-dark'] && 'dark:![color:var(--shiki-dark)]')}
                      >
                        {token.content}
                      </span>
                    ))
                  : text}
              </div>
              );
            })}
          </pre>
          <textarea
            ref={ref}
            value={code}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={invalid || undefined}
            rows={1}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            data-gramm="false"
            className={cn(
              textClass,
              'block h-full w-full resize-none overflow-hidden border-0 bg-transparent text-transparent caret-foreground outline-none',
              'selection:bg-primary/25 selection:text-transparent placeholder:text-subtle',
              'disabled:cursor-not-allowed',
              textareaClassName,
            )}
            {...textareaProps}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Inserts text at the selection through the browser's editing pipeline so it
 * lands in the native undo stack and fires a normal `input` → `onChange`.
 */
function insertText(el: HTMLTextAreaElement, text: string) {
  el.focus();
  const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!ok) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
