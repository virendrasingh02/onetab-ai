import { Button } from '../components/button.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip.js';
import { cn } from '@org/utils';
import { Check, Columns, Copy, Download, Rows } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  computeDiff,
  copyToClipboard,
  downloadAsFile,
  sanitizeFilename,
} from './code-block.utils.js';
import type { CodeBlockDiffMode } from './types.js';

export interface CodeBlockDiffProps {
  originalCode?: string;
  modifiedCode?: string;
  language?: string;
  filename?: string;
  diffViewMode?: CodeBlockDiffMode;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlockDiff({
  originalCode = '',
  modifiedCode = '',
  language = 'plaintext',
  filename,
  diffViewMode = 'unified',
  showLineNumbers = true,
  className,
}: CodeBlockDiffProps) {
  const [mode, setMode] = useState<CodeBlockDiffMode>(diffViewMode);
  const [copied, setCopied] = useState(false);

  const diffResult = useMemo(
    () => computeDiff(originalCode, modifiedCode),
    [originalCode, modifiedCode],
  );

  const handleCopyUpdated = async () => {
    const success = await copyToClipboard(modifiedCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadUpdated = () => {
    const targetName = sanitizeFilename(filename || 'modified_code', language);
    downloadAsFile(modifiedCode, targetName);
  };

  const { lines, addedCount, removedCount } = diffResult;

  return (
    <div className={cn('flex flex-col font-mono text-xs border border-border/80 rounded-b-lg overflow-hidden bg-surface-inset', className)}>
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-surface-raised/60 text-[11px] select-none">
        {/* Change Stats */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-muted-foreground">Changes:</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            +{addedCount}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
            -{removedCount}
          </span>
        </div>

        {/* View mode toggle and copy/download updated code */}
        <div className="flex items-center gap-1">
          {/* Mode Switch (Unified vs Split) - only visible on md+ screens */}
          <div className="hidden md:flex items-center bg-surface border border-border rounded-md p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setMode('unified')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors',
                mode === 'unified'
                  ? 'bg-surface-raised font-medium text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Rows className="size-3" />
              <span>Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('split')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors',
                mode === 'split'
                  ? 'bg-surface-raised font-medium text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Columns className="size-3" />
              <span>Split</span>
            </button>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyUpdated}
                className="size-6 text-muted-foreground hover:text-foreground"
                aria-label="Copy modified code"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied updated code!' : 'Copy updated code'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadUpdated}
                className="size-6 text-muted-foreground hover:text-foreground"
                aria-label="Download modified code"
              >
                <Download className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download updated file</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Diff Content View */}
      {mode === 'unified' ? (
        // Unified Diff View
        <div className="overflow-x-auto py-2 leading-5 scrollbar-subtle">
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {lines.map((line, idx) => {
                const isAdded = line.type === 'added';
                const isRemoved = line.type === 'removed';

                return (
                  <tr
                    key={`diff-${idx}`}
                    className={cn(
                      'transition-colors',
                      isAdded && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium',
                      isRemoved && 'bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium',
                      !isAdded && !isRemoved && 'text-foreground/90',
                    )}
                  >
                    {/* Old line number */}
                    {showLineNumbers && (
                      <td
                        aria-hidden="true"
                        className="select-none text-right pr-2 pl-3 text-muted-foreground/40 text-[11px] align-top w-[3ch]"
                      >
                        {line.oldLineNumber ?? ''}
                      </td>
                    )}

                    {/* New line number */}
                    {showLineNumbers && (
                      <td
                        aria-hidden="true"
                        className="select-none text-right pr-3 text-muted-foreground/40 text-[11px] align-top w-[3ch] border-r border-border/40"
                      >
                        {line.newLineNumber ?? ''}
                      </td>
                    )}

                    {/* Diff Marker (+ / -) */}
                    <td
                      aria-hidden="true"
                      className="select-none px-2 text-center font-bold text-[12px] align-top w-[2ch]"
                    >
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </td>

                    {/* Code Content */}
                    <td className="pr-4 whitespace-pre align-top w-full">
                      {line.content || '\n'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Split (Side-by-Side) Diff View
        <div className="overflow-x-auto py-2 leading-5 scrollbar-subtle">
          <div className="grid grid-cols-2 divide-x divide-border/60 min-w-[600px]">
            {/* Left side: Original */}
            <div>
              <div className="px-3 py-1 bg-surface-raised/40 border-b border-border/40 text-[11px] text-muted-foreground font-sans font-medium">
                Original
              </div>
              <div className="py-1">
                {lines
                  .filter((l) => l.type !== 'added')
                  .map((l, i) => (
                    <div
                      key={`orig-${i}`}
                      className={cn(
                        'flex items-center px-2 py-0.5 text-xs',
                        l.type === 'removed' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium',
                      )}
                    >
                      <span className="w-8 text-right pr-2 text-muted-foreground/40 text-[11px] select-none">
                        {l.oldLineNumber}
                      </span>
                      <span className="w-4 select-none text-center font-bold">
                        {l.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre overflow-hidden text-ellipsis">{l.content}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right side: Modified */}
            <div>
              <div className="px-3 py-1 bg-surface-raised/40 border-b border-border/40 text-[11px] text-muted-foreground font-sans font-medium">
                Modified
              </div>
              <div className="py-1">
                {lines
                  .filter((l) => l.type !== 'removed')
                  .map((l, i) => (
                    <div
                      key={`mod-${i}`}
                      className={cn(
                        'flex items-center px-2 py-0.5 text-xs',
                        l.type === 'added' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium',
                      )}
                    >
                      <span className="w-8 text-right pr-2 text-muted-foreground/40 text-[11px] select-none">
                        {l.newLineNumber}
                      </span>
                      <span className="w-4 select-none text-center font-bold">
                        {l.type === 'added' ? '+' : ' '}
                      </span>
                      <span className="whitespace-pre overflow-hidden text-ellipsis">{l.content}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
