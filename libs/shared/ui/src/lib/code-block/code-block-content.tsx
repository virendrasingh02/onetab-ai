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
  const [tokens, setTokens] = useState<HighlightedToken[][]>(() => plainTextToTokens(code));
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
    <div className="relative group">
      <div
        ref={containerRef}
        style={containerStyle}
        className={cn(
          'relative overflow-x-auto text-xs font-mono transition-[max-height] duration-200 scrollbar-subtle',
          !isWordWrap && 'overflow-x-auto',
          maxHeight && !isExpanded && 'overflow-y-hidden',
          className,
        )}
        tabIndex={0}
        role="region"
        aria-label={`${language} code snippet`}
      >
        <pre className="m-0 py-3 px-3.5 bg-transparent float-left min-w-full">
          <code className="block">
            {tokens.map((lineTokens, lineIndex) => {
              const currentLineNumber = startLineNumber + lineIndex;
              const isLineHighlighted = activeHighlightedLines.has(currentLineNumber);

              return (
                <div
                  key={`line-${currentLineNumber}`}
                  className={cn(
                    'table-row leading-5',
                    isLineHighlighted &&
                      'bg-primary/10 border-l-2 border-primary -ml-[2px] font-medium text-foreground',
                  )}
                >
                  {/* Line numbers gutter */}
                  {showLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="table-cell select-none pr-4 text-right text-muted-foreground/40 font-mono text-[11px] align-top"
                      style={{ minWidth: `${gutterWidth + 1}ch` }}
                    >
                      {currentLineNumber}
                    </span>
                  )}

                  {/* Terminal Prompt prefix ($) */}
                  {isTerminal && !showLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="table-cell select-none pr-2.5 text-muted-foreground/60 font-mono text-[11px] align-top"
                    >
                      $
                    </span>
                  )}

                  {/* Line token content */}
                  <span
                    className={cn(
                      'table-cell align-top',
                      isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre',
                    )}
                  >
                    {lineTokens.length === 0 || (lineTokens.length === 1 && lineTokens[0].content === '') ? (
                      // Empty line spacer
                      '\n'
                    ) : (
                      lineTokens.map((token, tokenIdx) => {
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
                      })
                    )}
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
            'flex items-center justify-center p-1.5 border-t border-border/60 bg-surface-raised/90 text-xs select-none backdrop-blur-xs',
            !isExpanded &&
              'absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/90 to-transparent pt-8',
          )}
        >
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-surface-raised border border-border shadow-xs hover:bg-accent text-foreground transition-colors"
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
