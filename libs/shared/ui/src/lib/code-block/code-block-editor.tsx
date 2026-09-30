import { Button } from '../components/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/dialog.js';
import { cn } from '@org/utils';
import { AlertCircle, RotateCcw, Save, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface CodeBlockEditorProps {
  initialCode: string;
  language?: string;
  showLineNumbers?: boolean;
  startLineNumber?: number;
  onSave?: (newCode: string) => void;
  onCancel?: () => void;
  onEdit?: (currentCode: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  className?: string;
}

export function CodeBlockEditor({
  initialCode,
  language = 'plaintext',
  showLineNumbers = true,
  startLineNumber = 1,
  onSave,
  onCancel,
  onEdit,
  onDirtyChange,
  className,
}: CodeBlockEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const isDirty = code !== initialCode;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync scrolling between textarea and line numbers gutter
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save shortcut: Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave?.(code);
      return;
    }

    // Cancel shortcut: Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelAttempt();
      return;
    }

    // Tab key: Indent / Unindent 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: Remove 2 leading spaces if present
        const before = code.substring(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        if (code.substring(lineStart, lineStart + 2) === '  ') {
          const newCode = code.substring(0, lineStart) + code.substring(lineStart + 2);
          setCode(newCode);
          onEdit?.(newCode);
          setTimeout(() => {
            target.selectionStart = Math.max(lineStart, start - 2);
            target.selectionEnd = Math.max(lineStart, end - 2);
          }, 0);
        }
      } else {
        // Tab: Insert 2 spaces
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newCode);
        onEdit?.(newCode);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onEdit?.(val);
  };

  const handleReset = () => {
    setCode(initialCode);
    onEdit?.(initialCode);
  };

  const handleCancelAttempt = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onCancel?.();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    setCode(initialCode);
    onCancel?.();
  };

  const lines = code.split('\n');
  const lineCount = lines.length;
  const gutterWidth = Math.max(String(startLineNumber + lineCount).length, 2);

  return (
    <div className={cn('relative flex flex-col font-mono text-xs border border-border/80 rounded-b-lg bg-surface-inset', className)}>
      <div className="relative flex flex-1 overflow-hidden min-h-[160px]">
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="select-none py-3 px-3 text-right bg-surface-raised/40 border-r border-border/50 text-muted-foreground/40 overflow-hidden leading-5"
            style={{ width: `${gutterWidth + 3}ch` }}
          >
            {lines.map((_, i) => (
              <div key={i}>{startLineNumber + i}</div>
            ))}
          </div>
        )}

        {/* Textarea Code Input */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="flex-1 w-full p-3 bg-transparent text-foreground resize-y leading-5 font-mono text-xs focus:outline-hidden whitespace-pre overflow-auto scrollbar-subtle"
          rows={Math.max(lineCount, 6)}
          aria-label={`Editing ${language} code`}
        />
      </div>

      {/* Editor Footer Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50 bg-surface-raised/60 text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <span>{lineCount} lines</span>
          {isDirty ? (
            <span className="text-amber-500 font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500 inline-block" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-muted-foreground/60">No changes</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelAttempt}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3" />
            <span>Cancel</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => onSave?.(code)}
            disabled={!isDirty}
            className="h-6 px-2.5 text-[11px] gap-1"
          >
            <Save className="size-3" />
            <span>Save</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog on Discarding Edits */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="size-4" />
              Discard unsaved changes?
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes in this code block. Leaving editing mode will permanently discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDiscardDialog(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
