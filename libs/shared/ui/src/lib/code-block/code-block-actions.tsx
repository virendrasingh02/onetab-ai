import { Button } from '../components/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip.js';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  Hash,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Play,
  RotateCcw,
  Save,
  WrapText,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { copyToClipboard, downloadAsFile, sanitizeFilename } from './code-block.utils.js';

export interface CodeBlockActionsProps {
  code: string;
  language?: string;
  filename?: string;
  isEditing?: boolean;
  isDirty?: boolean;
  isWordWrap?: boolean;
  showLineNumbers?: boolean;
  isExpanded?: boolean;
  isPreview?: boolean;
  canPreview?: boolean;
  editable?: boolean;
  readOnly?: boolean;
  showCopy?: boolean;
  showDownload?: boolean;
  showWrap?: boolean;
  showExpand?: boolean;
  canExecute?: boolean;
  isExecuting?: boolean;
  onToggleEdit?: () => void;
  onSave?: () => void;
  onReset?: () => void;
  onCancel?: () => void;
  onToggleWrap?: () => void;
  onToggleLineNumbers?: () => void;
  onToggleExpand?: () => void;
  onTogglePreview?: () => void;
  onExecute?: () => void;
  onCopySuccess?: () => void;
  onDownloadSuccess?: (filename: string) => void;
  className?: string;
}

export function CodeBlockActions({
  code,
  language,
  filename,
  isEditing = false,
  isDirty = false,
  isWordWrap = false,
  showLineNumbers = true,
  isExpanded = false,
  isPreview = false,
  canPreview = false,
  editable = false,
  readOnly = false,
  showCopy = true,
  showDownload = true,
  showWrap = true,
  showExpand = true,
  canExecute = false,
  isExecuting = false,
  onToggleEdit,
  onSave,
  onReset,
  onCancel,
  onToggleWrap,
  onToggleLineNumbers,
  onToggleExpand,
  onTogglePreview,
  onExecute,
  onCopySuccess,
  onDownloadSuccess,
  className,
}: CodeBlockActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (isCopying || copied) return;
    setIsCopying(true);
    const success = await copyToClipboard(code);
    setIsCopying(false);
    if (success) {
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const finalFilename = sanitizeFilename(filename, language);
    downloadAsFile(code, finalFilename);
    onDownloadSuccess?.(finalFilename);
  };

  return (
    <div className={cn('flex items-center gap-1 text-muted-foreground', className)}>
      {/* Editing Mode Controls */}
      {isEditing ? (
        <>
          {isDirty && onReset ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Reset edits"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset edits</TooltipContent>
            </Tooltip>
          ) : null}

          {onCancel ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Cancel editing"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel (Esc)</TooltipContent>
            </Tooltip>
          ) : null}

          {onSave ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSave}
                  className="h-7 px-2.5 text-xs gap-1.5"
                  aria-label="Save code"
                >
                  <Save className="size-3.5" />
                  <span>Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save changes (Ctrl+S / Cmd+S)</TooltipContent>
            </Tooltip>
          ) : null}
        </>
      ) : (
        <>
          {/* Execution Button */}
          {canExecute && onExecute ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExecute}
                  disabled={isExecuting}
                  className="h-7 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  aria-label="Run code"
                >
                  <Play className={cn('size-3.5 fill-current', isExecuting && 'animate-spin')} />
                  <span>{isExecuting ? 'Running...' : 'Run'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run snippet</TooltipContent>
            </Tooltip>
          ) : null}

          {/* Preview Toggle (HTML / CSS / SVG) */}
          {canPreview && onTogglePreview ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPreview ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onTogglePreview}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={isPreview ? 'Show Code' : 'Show Preview'}
                >
                  <Eye className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPreview ? 'Show Code' : 'Show Preview'}</TooltipContent>
            </Tooltip>
          ) : null}

          {/* Edit Toggle */}
          {editable && !readOnly && onToggleEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleEdit}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Edit code"
                >
                  <Edit3 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit code</TooltipContent>
            </Tooltip>
          ) : null}

          {/* Copy Button */}
          {showCopy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className={cn(
                    'size-7 transition-colors',
                    copied
                      ? 'text-emerald-500 hover:text-emerald-600'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label={copied ? 'Copied code' : 'Copy code to clipboard'}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy code'}</TooltipContent>
            </Tooltip>
          ) : null}

          {/* Desktop visible actions */}
          <div className="hidden sm:flex items-center gap-1">
            {/* Word wrap toggle */}
            {showWrap && onToggleWrap ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isWordWrap ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={onToggleWrap}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={isWordWrap ? 'Disable word wrap' : 'Enable word wrap'}
                  >
                    <WrapText className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isWordWrap ? 'Disable word wrap' : 'Wrap lines'}</TooltipContent>
              </Tooltip>
            ) : null}

            {/* Line numbers toggle */}
            {onToggleLineNumbers ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showLineNumbers ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={onToggleLineNumbers}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
                  >
                    <Hash className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {/* Download Button */}
            {showDownload ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label="Download code file"
                  >
                    <Download className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download file</TooltipContent>
              </Tooltip>
            ) : null}

            {/* Expand / Modal Fullscreen Toggle */}
            {showExpand && onToggleExpand ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleExpand}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={isExpanded ? 'Collapse' : 'Expand full screen'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="size-3.5" />
                    ) : (
                      <Maximize2 className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isExpanded ? 'Collapse view' : 'Expand full view'}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          {/* Mobile / Overflow Dropdown Menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                {showWrap && onToggleWrap ? (
                  <DropdownMenuItem onClick={onToggleWrap}>
                    <WrapText className="size-3.5 mr-2" />
                    <span>{isWordWrap ? 'Disable wrap' : 'Wrap lines'}</span>
                  </DropdownMenuItem>
                ) : null}

                {onToggleLineNumbers ? (
                  <DropdownMenuItem onClick={onToggleLineNumbers}>
                    <Hash className="size-3.5 mr-2" />
                    <span>{showLineNumbers ? 'Hide lines' : 'Show line numbers'}</span>
                  </DropdownMenuItem>
                ) : null}

                {showDownload ? (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="size-3.5 mr-2" />
                    <span>Download file</span>
                  </DropdownMenuItem>
                ) : null}

                {showExpand && onToggleExpand ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onToggleExpand}>
                      {isExpanded ? (
                        <>
                          <Minimize2 className="size-3.5 mr-2" />
                          <span>Collapse</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="size-3.5 mr-2" />
                          <span>Expand view</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  );
}
