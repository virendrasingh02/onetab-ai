import { Button } from '../components/button.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/tooltip.js';
import { cn } from '@org/utils';
import { Check, Columns, Copy, Download, Rows } from 'lucide-react';
import { useMemo, useState } from 'react';
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
    <div
      className={cn(
        'text-xs flex flex-col overflow-hidden rounded-b-lg border border-border/80 bg-surface-inset font-mono',
        className,
      )}
    >
      {/* Diff Toolbar */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-border/60 bg-surface-raised/60 text-meta select-none">
        {/* Change Stats */}
        <div className="gap-2 flex items-center">
          <span className="font-sans text-muted-foreground">Changes:</span>
          <span className="px-1.5 py-0.5 rounded font-semibold bg-success/10 text-success-text">
            +{addedCount}
          </span>
          <span className="px-1.5 py-0.5 rounded font-semibold bg-destructive/10 text-destructive-text">
            -{removedCount}
          </span>
        </div>

        {/* View mode toggle and copy/download updated code */}
        <div className="gap-1 flex items-center">
          {/* Mode Switch (Unified vs Split) - only visible on md+ screens */}
          <div className="md:flex p-0.5 mr-1 hidden items-center rounded-md border border-border bg-surface">
            <button
              type="button"
              onClick={() => setMode('unified')}
              className={cn(
                'gap-1 px-2 py-0.5 rounded flex items-center text-meta transition-colors',
                mode === 'unified'
                  ? 'font-medium bg-surface-raised text-foreground shadow-xs'
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
                'gap-1 px-2 py-0.5 rounded flex items-center text-meta transition-colors',
                mode === 'split'
                  ? 'font-medium bg-surface-raised text-foreground shadow-xs'
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
                {copied ? (
                  <Check className="size-3 text-success-text" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? 'Copied updated code!' : 'Copy updated code'}
            </TooltipContent>
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
        <div className="py-2 leading-5 scrollbar-subtle overflow-x-auto">
          <table className="text-xs w-full border-collapse font-mono">
            <tbody>
              {lines.map((line, idx) => {
                const isAdded = line.type === 'added';
                const isRemoved = line.type === 'removed';

                return (
                  <tr
                    key={`diff-${idx}`}
                    className={cn(
                      'transition-colors',
                      isAdded && 'font-medium bg-success/10 text-success-text',
                      isRemoved &&
                        'font-medium bg-destructive/10 text-destructive-text',
                      !isAdded && !isRemoved && 'text-foreground/90',
                    )}
                  >
                    {/* Old line number */}
                    {showLineNumbers && (
                      <td
                        aria-hidden="true"
                        className="pr-2 pl-3 w-[3ch] text-right align-top text-meta text-muted-foreground/40 select-none"
                      >
                        {line.oldLineNumber ?? ''}
                      </td>
                    )}

                    {/* New line number */}
                    {showLineNumbers && (
                      <td
                        aria-hidden="true"
                        className="pr-3 w-[3ch] border-r border-border/40 text-right align-top text-meta text-muted-foreground/40 select-none"
                      >
                        {line.newLineNumber ?? ''}
                      </td>
                    )}

                    {/* Diff Marker (+ / -) */}
                    <td
                      aria-hidden="true"
                      className="px-2 font-bold text-xs w-[2ch] text-center align-top select-none"
                    >
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </td>

                    {/* Code Content */}
                    <td className="pr-4 w-full align-top whitespace-pre">
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
        <div className="py-2 leading-5 scrollbar-subtle overflow-x-auto">
          <div className="grid min-w-[600px] grid-cols-2 divide-x divide-border/60">
            {/* Left side: Original */}
            <div>
              <div className="px-3 py-1 font-medium border-b border-border/40 bg-surface-raised/40 font-sans text-meta text-muted-foreground">
                Original
              </div>
              <div className="py-1">
                {lines
                  .filter((l) => l.type !== 'added')
                  .map((l, i) => (
                    <div
                      key={`orig-${i}`}
                      className={cn(
                        'px-2 py-0.5 text-xs flex items-center',
                        l.type === 'removed' &&
                          'font-medium bg-destructive/10 text-destructive-text',
                      )}
                    >
                      <span className="w-8 pr-2 text-right text-meta text-muted-foreground/40 select-none">
                        {l.oldLineNumber}
                      </span>
                      <span className="w-4 font-bold text-center select-none">
                        {l.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="overflow-hidden text-ellipsis whitespace-pre">
                        {l.content}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right side: Modified */}
            <div>
              <div className="px-3 py-1 font-medium border-b border-border/40 bg-surface-raised/40 font-sans text-meta text-muted-foreground">
                Modified
              </div>
              <div className="py-1">
                {lines
                  .filter((l) => l.type !== 'removed')
                  .map((l, i) => (
                    <div
                      key={`mod-${i}`}
                      className={cn(
                        'px-2 py-0.5 text-xs flex items-center',
                        l.type === 'added' &&
                          'font-medium bg-success/10 text-success-text',
                      )}
                    >
                      <span className="w-8 pr-2 text-right text-meta text-muted-foreground/40 select-none">
                        {l.newLineNumber}
                      </span>
                      <span className="w-4 font-bold text-center select-none">
                        {l.type === 'added' ? '+' : ' '}
                      </span>
                      <span className="overflow-hidden text-ellipsis whitespace-pre">
                        {l.content}
                      </span>
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
