import { Badge } from '../components/badge.js';
import { cn } from '@org/utils';
import {
  Code2,
  FileCode,
  GitCompare,
  Terminal,
} from 'lucide-react';
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
  const isTerminal = variant === 'terminal' || TERMINAL_LANGUAGES.has(normalized);
  const isDiff = variant === 'diff';

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border/70 bg-surface-raised/80 px-3 text-xs backdrop-blur-xs select-none',
        variant === 'compact' ? 'h-7 px-2.5' : 'h-8 px-3',
        className,
      )}
    >
      {/* Left side: Terminal dots or Language / Filename Info */}
      <div className="flex items-center gap-2 min-w-0">
        {isTerminal ? (
          <div className="flex items-center gap-1.5 mr-1" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
        ) : null}

        {/* Icon */}
        <div className="text-muted-foreground shrink-0">
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
        <div className="flex items-center gap-2 truncate font-mono text-[11px]">
          {filename ? (
            <span className="font-semibold text-foreground truncate">{filename}</span>
          ) : null}

          {/* Language tag */}
          {(!filename || isTerminal) && (
            <span className="font-medium text-muted-foreground tracking-wide">
              {displayLang}
            </span>
          )}

          {/* Title description if present */}
          {title ? (
            <span className="hidden md:inline font-sans text-muted-foreground/80 truncate">
              — {title}
            </span>
          ) : null}
        </div>

        {/* Unsaved changes badge */}
        {isEditing && isDirty ? (
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 font-sans"
          >
            Modified
          </Badge>
        ) : null}

        {/* Line count */}
        {typeof lineCount === 'number' && lineCount > 0 ? (
          <span className="hidden lg:inline text-[11px] text-muted-foreground/60 font-sans">
            ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
          </span>
        ) : null}
      </div>

      {/* Right side: Toolbar Actions */}
      {actionsSlot ? <div className="shrink-0 ml-2">{actionsSlot}</div> : null}
    </div>
  );
}
