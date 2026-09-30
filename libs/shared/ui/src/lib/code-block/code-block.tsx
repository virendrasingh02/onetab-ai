import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/dialog.js';
import { cn } from '@org/utils';
import React, { useMemo, useState } from 'react';
import { CodeBlockActions } from './code-block-actions.js';
import { CodeBlockContent } from './code-block-content.js';
import { CodeBlockDiff } from './code-block-diff.js';
import { CodeBlockEditor } from './code-block-editor.js';
import { CodeBlockExecution } from './code-block-execution.js';
import { CodeBlockHeader } from './code-block-header.js';
import { CodeBlockPreview, isLanguagePreviewable } from './code-block-preview.js';
import {
  detectLanguage,
  getLanguageName,
  normalizeLanguage,
} from './code-block.utils.js';
import type { CodeBlockProps } from './types.js';

export function CodeBlock({
  code: propCode,
  children,
  language: propLanguage,
  filename,
  title,
  variant = 'default',
  showLineNumbers: propShowLineNumbers,
  highlightedLines,
  startLineNumber = 1,
  editable = false,
  readOnly = false,
  showCopy = true,
  showDownload = true,
  showWrap = true,
  showExpand = true,
  showHeader: propShowHeader,
  maxHeight,
  className,
  originalCode,
  modifiedCode,
  diffViewMode = 'unified',
  canExecute = false,
  onExecute,
  executionStatus = 'unavailable',
  executionOutput,
  onCopy,
  onEdit,
  onSave,
  onCancel,
  onDownload,
}: CodeBlockProps) {
  // Extract text from code prop or children
  const rawCode = useMemo(() => {
    if (typeof propCode === 'string') return propCode;
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) {
      return children.filter((c) => typeof c === 'string').join('');
    }
    return '';
  }, [propCode, children]);

  // Language resolution: explicit prop -> auto-detection fallback
  const resolvedLanguage = useMemo(() => {
    if (propLanguage && propLanguage !== 'auto') {
      return normalizeLanguage(propLanguage);
    }
    return detectLanguage(rawCode);
  }, [propLanguage, rawCode]);

  // Internal state
  const [currentCode, setCurrentCode] = useState(rawCode);
  const [isEditing, setIsEditing] = useState(variant === 'editor' && editable && !readOnly);
  const [isDirty, setIsDirty] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(
    propShowLineNumbers ??
      (variant === 'default' || variant === 'editor' || variant === 'diff'),
  );
  const [internalPreview, setInternalPreview] = useState(false);
  const isPreview = variant === 'preview' || internalPreview;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync if propCode changes externally
  React.useEffect(() => {
    setCurrentCode(rawCode);
    setIsDirty(false);
  }, [rawCode]);

  // If variant is inline, render compact inline code
  if (variant === 'inline') {
    return (
      <code
        className={cn(
          'rounded bg-surface-inset px-1.5 py-0.5 font-mono text-[0.875em] text-info-text border border-border/40 select-all',
          className,
        )}
      >
        {rawCode}
      </code>
    );
  }

  const isTerminal = variant === 'terminal';
  const isDiff = variant === 'diff';
  const showHeader = propShowHeader ?? (variant !== 'inline');
  const lineCount = (isEditing ? currentCode : rawCode).split('\n').length;
  const canPreview = isLanguagePreviewable(resolvedLanguage);

  const handleSave = (newCode: string) => {
    setCurrentCode(newCode);
    setIsDirty(false);
    setIsEditing(false);
    onSave?.(newCode);
  };

  const handleCancel = () => {
    setCurrentCode(rawCode);
    setIsDirty(false);
    setIsEditing(false);
    onCancel?.();
  };

  const handleToggleEdit = () => {
    if (readOnly) return;
    if (isEditing) {
      handleCancel();
    } else {
      setIsEditing(true);
    }
  };

  const actionsSlot = (
    <CodeBlockActions
      code={isEditing ? currentCode : rawCode}
      language={resolvedLanguage}
      filename={filename}
      isEditing={isEditing}
      isDirty={isDirty}
      isWordWrap={isWordWrap}
      showLineNumbers={showLineNumbers}
      isExpanded={isModalOpen}
      isPreview={isPreview}
      canPreview={canPreview}
      editable={editable}
      readOnly={readOnly}
      showCopy={showCopy}
      showDownload={showDownload}
      showWrap={showWrap}
      showExpand={showExpand && variant !== 'compact'}
      canExecute={canExecute}
      isExecuting={executionStatus === 'running'}
      onToggleEdit={editable && !readOnly ? handleToggleEdit : undefined}
      onSave={isEditing ? () => handleSave(currentCode) : undefined}
      onReset={isEditing ? () => setCurrentCode(rawCode) : undefined}
      onCancel={isEditing ? handleCancel : undefined}
      onToggleWrap={() => setIsWordWrap(!isWordWrap)}
      onToggleLineNumbers={() => setShowLineNumbers(!showLineNumbers)}
      onToggleExpand={() => setIsModalOpen(true)}
      onTogglePreview={canPreview ? () => setIsPreview(!isPreview) : undefined}
      onExecute={onExecute ? () => onExecute(rawCode) : undefined}
      onCopySuccess={() => onCopy?.(rawCode)}
      onDownloadSuccess={(fn) => onDownload?.(rawCode, fn)}
    />
  );

  return (
    <>
      <div
        className={cn(
          'group/code my-2 w-full rounded-lg border border-border/80 bg-surface shadow-xs transition-colors overflow-hidden',
          isTerminal && 'bg-zinc-950 text-zinc-100 border-zinc-800',
          variant === 'compact' && 'my-1 rounded-md text-[11px]',
          className,
        )}
      >
        {/* Header Toolbar */}
        {showHeader && (
          <CodeBlockHeader
            language={resolvedLanguage}
            filename={filename}
            title={title}
            lineCount={lineCount}
            variant={variant}
            isEditing={isEditing}
            isDirty={isDirty}
            actionsSlot={actionsSlot}
          />
        )}

        {/* Body based on state & variant */}
        {isEditing ? (
          <CodeBlockEditor
            initialCode={rawCode}
            language={resolvedLanguage}
            showLineNumbers={showLineNumbers}
            startLineNumber={startLineNumber}
            onSave={handleSave}
            onCancel={handleCancel}
            onEdit={(val) => {
              setCurrentCode(val);
              setIsDirty(val !== rawCode);
              onEdit?.(val);
            }}
            onDirtyChange={setIsDirty}
          />
        ) : isDiff ? (
          <CodeBlockDiff
            originalCode={originalCode ?? rawCode}
            modifiedCode={modifiedCode ?? ''}
            language={resolvedLanguage}
            filename={filename}
            diffViewMode={diffViewMode}
            showLineNumbers={showLineNumbers}
          />
        ) : isPreview ? (
          <CodeBlockPreview
            code={rawCode}
            language={resolvedLanguage}
          />
        ) : (
          <CodeBlockContent
            code={rawCode}
            language={resolvedLanguage}
            showLineNumbers={showLineNumbers}
            startLineNumber={startLineNumber}
            highlightedLines={highlightedLines}
            isWordWrap={isWordWrap}
            maxHeight={maxHeight}
            isTerminal={isTerminal}
          />
        )}

        {/* Execution UI section if enabled */}
        {canExecute && (
          <CodeBlockExecution
            code={rawCode}
            language={resolvedLanguage}
            status={executionStatus}
            output={executionOutput}
            onExecute={onExecute}
          />
        )}
      </div>

      {/* Expanded Modal / Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
          <DialogHeader className="px-4 py-3 border-b border-border bg-surface-raised">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <span>{filename || title || `${getLanguageName(resolvedLanguage)} Code`}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({lineCount} lines)
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Expanded full view of code snippet
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-surface-inset max-h-[calc(90vh-100px)]">
            <CodeBlockContent
              code={isEditing ? currentCode : rawCode}
              language={resolvedLanguage}
              showLineNumbers={showLineNumbers}
              startLineNumber={startLineNumber}
              highlightedLines={highlightedLines}
              isWordWrap={isWordWrap}
              isTerminal={isTerminal}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
