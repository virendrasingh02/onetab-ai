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
          const newCode =
            code.substring(0, lineStart) + code.substring(lineStart + 2);
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
    <div
      className={cn(
        'text-xs relative flex flex-col rounded-b-lg border border-border/80 bg-surface-inset font-mono',
        className,
      )}
    >
      <div className="relative flex min-h-[160px] flex-1 overflow-hidden">
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="py-3 px-3 leading-5 overflow-hidden border-r border-border/50 bg-surface-raised/40 text-right text-muted-foreground/40 select-none"
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
          className="p-3 leading-5 text-xs scrollbar-subtle w-full flex-1 resize-y overflow-auto bg-transparent font-mono whitespace-pre text-foreground focus:outline-hidden"
          rows={Math.max(lineCount, 6)}
          aria-label={`Editing ${language} code`}
        />
      </div>

      {/* Editor Footer Status Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between border-t border-border/50 bg-surface-raised/60 text-meta text-muted-foreground select-none">
        <div className="gap-2 flex items-center">
          <span>{lineCount} lines</span>
          {isDirty ? (
            <span className="font-medium gap-1 flex items-center text-warning-text">
              <span className="size-1.5 inline-block rounded-full bg-warning" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-muted-foreground/60">No changes</span>
          )}
        </div>

        <div className="gap-1.5 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty}
            className="h-6 px-2 gap-1 text-meta text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelAttempt}
            className="h-6 px-2 gap-1 text-meta text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            <span>Cancel</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => onSave?.(code)}
            disabled={!isDirty}
            className="h-6 px-2.5 gap-1 text-meta"
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
            <DialogTitle className="gap-2 flex items-center text-warning">
              <AlertCircle className="size-4" />
              Discard unsaved changes?
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes in this code block. Leaving editing mode
              will permanently discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDiscardDialog(false)}
            >
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
