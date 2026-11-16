import { Badge } from '../components/badge.js';
import { cn } from '@org/utils';
import { Code2, FileCode, GitCompare, Terminal } from 'lucide-react';
import React from 'react';
import { getLanguageName, normalizeLanguage } from './code-block.utils.js';
import { TERMINAL_LANGUAGES } from './code-block.constants.js';
import type { CodeBlockVariant } from './types.js';

export interface CodeBlockHeaderProps {
  language?: string;
  filename?: string;
  title?: string;
  lineCount?: number;
  variant?: CodeBlockVariant;
  isEditing?: boolean;
  isDirty?: boolean;
  actionsSlot?: React.ReactNode;
  className?: string;
}

export function CodeBlockHeader({
  language,
  filename,
  title,
  lineCount,
  variant = 'default',
  isEditing = false,
  isDirty = false,
  actionsSlot,
  className,
}: CodeBlockHeaderProps) {
  const normalized = normalizeLanguage(language);
  const displayLang = getLanguageName(language);
  const isTerminal =
    variant === 'terminal' || TERMINAL_LANGUAGES.has(normalized);
  const isDiff = variant === 'diff';

  return (
    <div
      className={cn(
        'px-3 text-xs backdrop-blur-xs flex items-center justify-between border-b border-border/70 bg-surface-raised/80 select-none',
        variant === 'compact' ? 'h-7 px-2.5' : 'h-8 px-3',
        className,
      )}
    >
      {/* Left side: Terminal dots or Language / Filename Info */}
      <div className="gap-2 min-w-0 flex items-center">
        {/* Icon */}
        <div className="shrink-0 text-muted-foreground">
          {isTerminal ? (
            <Terminal className="size-3.5 text-muted-foreground" />
          ) : isDiff ? (
            <GitCompare className="size-3.5 text-accent-blue" />
          ) : filename ? (
            <FileCode className="size-3.5 text-accent-cyan" />
          ) : (
            <Code2 className="size-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Filename or Language Name */}
        <div className="gap-2 flex items-center truncate font-mono text-meta">
          {filename ? (
            <span className="font-semibold truncate text-foreground">
              {filename}
            </span>
          ) : null}

          {/* Language tag */}
          {(!filename || isTerminal) && (
            <span className="font-medium tracking-wide text-muted-foreground">
              {displayLang}
            </span>
          )}

          {/* Title description if present */}
          {title ? (
            <span className="md:inline hidden truncate font-sans text-muted-foreground/80">
              — {title}
            </span>
          ) : null}
        </div>

        {/* Unsaved changes badge */}
        {isEditing && isDirty ? (
          <Badge
            variant="outline"
            className="h-4 px-1.5 border-warning/30 bg-warning/10 font-sans text-2xs text-warning-text"
          >
            Modified
          </Badge>
        ) : null}

        {/* Line count */}
        {typeof lineCount === 'number' && lineCount > 0 ? (
          <span className="lg:inline hidden font-sans text-meta text-muted-foreground/60">
            ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
          </span>
        ) : null}
      </div>

      {/* Right side: Toolbar Actions */}
      {actionsSlot ? <div className="ml-2 shrink-0">{actionsSlot}</div> : null}
    </div>
  );
}
