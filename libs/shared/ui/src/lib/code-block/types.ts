import type { ReactNode } from 'react';

export type CodeBlockVariant =
  | 'default'
  | 'inline'
  | 'compact'
  | 'editor'
  | 'diff'
  | 'terminal'
  | 'preview';

export type CodeBlockDiffMode = 'unified' | 'split';

export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'unavailable';

export interface CodeBlockProps {
  /** The source code to display or edit */
  code?: string;
  /** Children can be passed as alternate source code (string) */
  children?: ReactNode;
  /** Programming language or alias (e.g. 'typescript', 'tsx', 'python', 'json', 'bash') */
  language?: string;
  /** Optional filename shown in header (e.g. 'server.ts') */
  filename?: string;
  /** Optional title or description shown in header */
  title?: string;
  /** Display variant */
  variant?: CodeBlockVariant;
  /** Show line numbers gutter */
  showLineNumbers?: boolean;
  /** Specific lines or ranges to highlight (e.g. [1, 4] or "1, 3-5") */
  highlightedLines?: number[] | string;
  /** Starting line number (defaults to 1) */
  startLineNumber?: number;
  /** Allow inline editing of the code */
  editable?: boolean;
  /** Mark as read-only (disables editing even if editable is true) */
  readOnly?: boolean;
  /** Show copy button in header/actions */
  showCopy?: boolean;
  /** Show download file button in header/actions */
  showDownload?: boolean;
  /** Show word wrap toggle button in header/actions */
  showWrap?: boolean;
  /** Show expand / fullscreen dialog button in header/actions */
  showExpand?: boolean;
  /** Show top header toolbar */
  showHeader?: boolean;
  /** Maximum height before scrolling and show more/less toggle kicks in */
  maxHeight?: number | string;
  /** Additional custom class name */
  className?: string;

  // Diff Props
  /** Original code for diff comparison */
  originalCode?: string;
  /** Modified code for diff comparison */
  modifiedCode?: string;
  /** Diff view mode: unified or side-by-side split */
  diffViewMode?: CodeBlockDiffMode;

  // Execution Props
  /** Enable execution UI */
  canExecute?: boolean;
  /** Callback when user clicks Run / Execute */
  onExecute?: (code: string) => Promise<void> | void;
  /** Current execution status */
  executionStatus?: ExecutionStatus;
  /** Output from execution */
  executionOutput?: string;

  // Callbacks
  /** Called when code is copied */
  onCopy?: (code: string) => void;
  /** Called when code is edited */
  onEdit?: (code: string) => void;
  /** Called when edited code is saved */
  onSave?: (code: string) => void;
  /** Called when code editing is cancelled */
  onCancel?: () => void;
  /** Called when code is downloaded */
  onDownload?: (code: string, filename: string) => void;
  /** Optional custom metadata */
  metadata?: Record<string, unknown>;
}

export interface HighlightedToken {
  content: string;
  htmlStyle?: Record<string, string>;
  color?: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
}
