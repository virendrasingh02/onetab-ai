import { cn } from '@org/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  highlightCodeToTokens,
  parseHighlightedLines,
  plainTextToTokens,
} from './code-block.utils.js';
import type { HighlightedToken } from './types.js';

export interface CodeBlockContentProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startLineNumber?: number;
  highlightedLines?: number[] | string;
  isWordWrap?: boolean;
  maxHeight?: number | string;
  isTerminal?: boolean;
  className?: string;
}

export function CodeBlockContent({
  code,
  language = 'plaintext',
  showLineNumbers = true,
  startLineNumber = 1,
  highlightedLines,
  isWordWrap = false,
  maxHeight,
  isTerminal = false,
  className,
}: CodeBlockContentProps) {
  const [tokens, setTokens] = useState<HighlightedToken[][]>(() =>
    plainTextToTokens(code),
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHighlightedLines = useMemo(
    () => parseHighlightedLines(highlightedLines),
    [highlightedLines],
  );

  // Update tokens with Shiki highlighting
  useEffect(() => {
    let isCancelled = false;

    // Fast initial fallback rendering for immediate response (e.g. during streaming)
    setTokens(plainTextToTokens(code));

    // Async highlight with Shiki
    const timer = setTimeout(async () => {
      try {
        const highlighted = await highlightCodeToTokens(code, language);
        if (!isCancelled && highlighted) {
          setTokens(highlighted);
        }
      } catch {
        // Safe fallback if highlighting errors
        if (!isCancelled) {
          setTokens(plainTextToTokens(code));
        }
      }
    }, 30);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [code, language]);

  // Determine if content overflows maxHeight
  useEffect(() => {
    if (maxHeight && containerRef.current) {
      const scrollHeight = containerRef.current.scrollHeight;
      const parsedMaxHeight =
        typeof maxHeight === 'number' ? maxHeight : parseInt(maxHeight, 10);
      if (!isNaN(parsedMaxHeight) && scrollHeight > parsedMaxHeight + 40) {
        setCanExpand(true);
      } else {
        setCanExpand(false);
      }
    } else {
      setCanExpand(false);
    }
  }, [code, maxHeight]);

  const totalLines = tokens.length;
  const gutterWidth = Math.max(String(startLineNumber + totalLines).length, 2);

  const containerStyle = useMemo(() => {
    if (!maxHeight || isExpanded) return undefined;
    return {
      maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
    };
  }, [maxHeight, isExpanded]);

  return (
    <div className="group relative">
      <div
        ref={containerRef}
        style={containerStyle}
        className={cn(
          'text-xs scrollbar-subtle relative overflow-x-auto font-mono transition-[max-height] duration-200',
          !isWordWrap && 'overflow-x-auto',
          maxHeight && !isExpanded && 'overflow-y-hidden',
          className,
        )}
        tabIndex={0}
        role="region"
        aria-label={`${language} code snippet`}
      >
        <pre className="m-0 py-2 px-3.5 float-left min-w-full bg-transparent">
          <code className="block">
            {tokens.map((lineTokens, lineIndex) => {
              const currentLineNumber = startLineNumber + lineIndex;
              const isLineHighlighted =
                activeHighlightedLines.has(currentLineNumber);

              return (
                <div
                  key={`line-${currentLineNumber}`}
                  className={cn(
                    'leading-5 table-row',
                    isLineHighlighted &&
                      'font-medium -ml-[2px] border-l-2 border-primary bg-primary/10 text-foreground',
                  )}
                >
                  {/* Line numbers gutter */}
                  {showLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="pr-4 table-cell text-right align-top font-mono text-meta text-muted-foreground/40 select-none"
                      style={{ minWidth: `${gutterWidth + 1}ch` }}
                    >
                      {currentLineNumber}
                    </span>
                  )}

                  {/* Terminal Prompt prefix ($) */}
                  {isTerminal && !showLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="pr-2.5 table-cell align-top font-mono text-meta text-muted-foreground/60 select-none"
                    >
                      $
                    </span>
                  )}

                  {/* Line token content */}
                  <span
                    className={cn(
                      'table-cell align-top',
                      isWordWrap
                        ? 'break-all whitespace-pre-wrap'
                        : 'whitespace-pre',
                    )}
                  >
                    {lineTokens.length === 0 ||
                    (lineTokens.length === 1 && lineTokens[0].content === '')
                      ? // Empty line spacer
                        '\n'
                      : lineTokens.map((token, tokenIdx) => {
                          const style: React.CSSProperties = {
                            color: token.htmlStyle?.color || token.color,
                            ...(token.htmlStyle as any),
                          };

                          return (
                            <span
                              key={`tok-${tokenIdx}`}
                              style={style}
                              className={cn(
                                token.htmlStyle?.['--shiki-dark'] &&
                                  'dark:![color:var(--shiki-dark)]',
                              )}
                            >
                              {token.content}
                            </span>
                          );
                        })}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Show more / Show less toggle button if content exceeds maxHeight */}
      {canExpand ? (
        <div
          className={cn(
            'p-1.5 text-xs backdrop-blur-xs flex items-center justify-center border-t border-border/60 bg-surface-raised/90 select-none',
            !isExpanded &&
              'inset-x-0 bottom-0 pt-8 absolute bg-gradient-to-t from-surface via-surface/90 to-transparent',
          )}
        >
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1.5 px-3 py-1 font-medium flex items-center rounded-full border border-border bg-surface-raised text-meta text-foreground shadow-xs transition-colors hover:bg-accent"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3.5" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                <span>Show more ({totalLines} lines)</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
