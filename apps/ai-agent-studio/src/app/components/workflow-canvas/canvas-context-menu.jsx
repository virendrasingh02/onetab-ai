import React, { useEffect, useRef } from 'react';
import {
  Clipboard,
  Copy,
  Download,
  Info,
  Maximize2,
  Play,
  Plus,
  Scissors,
  Sliders,
  Split,
  Trash2,
  Wand2,
} from 'lucide-react';

/**
 * @typedef {import('@xyflow/react').Node} FlowNode
 * @typedef {import('@xyflow/react').Edge} FlowEdge
 * @typedef {{
 *   isOpen: boolean;
 *   x: number;
 *   y: number;
 *   targetNode?: FlowNode | null;
 *   targetEdge?: FlowEdge | null;
 *   hasClipboard?: boolean;
 *   onClose: () => void;
 *   onAutoLayout?: (dir?: 'LR' | 'TB') => void;
 *   onFitView?: () => void;
 *   onAddNode?: (pos: { x: number; y: number }) => void;
 *   onDuplicateNode?: (node: FlowNode) => void;
 *   onCopyNode?: (node: FlowNode) => void;
 *   onCutNode?: (node: FlowNode) => void;
 *   onPaste?: () => void;
 *   onSelectAll?: () => void;
 *   onDeleteNode?: (id: string) => void;
 *   onTestNode?: (node: FlowNode) => void;
 *   onInspectNode?: (node: FlowNode) => void;
 *   onInspectEdge?: (edge: FlowEdge) => void;
 *   onDeleteEdge?: (id: string) => void;
 *   onInsertNodeOnEdge?: (edge: FlowEdge) => void;
 *   onExportJson?: () => void;
 * }} CanvasContextMenuProps
 */

/** @param {CanvasContextMenuProps} props */
export function CanvasContextMenu({
  isOpen,
  x,
  y,
  targetNode = null,
  targetEdge = null,
  hasClipboard = false,
  onClose,
  onAutoLayout,
  onFitView,
  onAddNode,
  onDuplicateNode,
  onCopyNode,
  onCutNode,
  onPaste,
  onSelectAll,
  onDeleteNode,
  onTestNode,
  onInspectNode,
  onInspectEdge,
  onDeleteEdge,
  onInsertNodeOnEdge,
  onExportJson,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 min-w-[210px] overflow-hidden rounded-xl border border-border bg-surface/98 backdrop-blur-md p-1.5 shadow-2xl text-xs text-foreground select-none animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {targetNode ? (
        // 1. Node Context Actions
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border/60 mb-1">
            Step: {targetNode.data?.label || targetNode.id}
          </div>

          <button
            type="button"
            onClick={() => {
              onTestNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
          >
            <Play className="size-3.5 fill-current text-primary" />
            <span>Test Step Execution</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onInspectNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <Info className="size-3.5 text-muted-foreground" />
            <span>Configure Step</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onCopyNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy className="size-3.5 text-muted-foreground" />
              <span>Copy</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onCutNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Scissors className="size-3.5 text-muted-foreground" />
              <span>Cut</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Ctrl+X</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicateNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy className="size-3.5 text-muted-foreground" />
              <span>Duplicate</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Ctrl+D</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onDeleteNode?.(targetNode.id);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="size-3.5" />
              <span>Delete Step</span>
            </div>
            <span className="text-[10px] text-destructive/70 font-mono">Del</span>
          </button>
        </div>
      ) : targetEdge ? (
        // 2. Edge Context Actions
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border/60 mb-1">
            Connection: {targetEdge.id}
          </div>

          <button
            type="button"
            onClick={() => {
              onInspectEdge?.(targetEdge);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
          >
            <Sliders className="size-3.5 text-primary" />
            <span>Inspect Data Flow</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onInsertNodeOnEdge?.(targetEdge);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <Plus className="size-3.5 text-muted-foreground" />
            <span>Insert Step Between</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onDeleteEdge?.(targetEdge.id);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="size-3.5" />
              <span>Delete Connection</span>
            </div>
            <span className="text-[10px] text-destructive/70 font-mono">Del</span>
          </button>
        </div>
      ) : (
        // 3. Canvas Background Actions
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border/60 mb-1">
            Canvas Actions
          </div>

          <button
            type="button"
            onClick={() => {
              onAddNode?.({ x, y });
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left font-medium cursor-pointer"
          >
            <Plus className="size-3.5 text-primary" />
            <span>Add Step Here…</span>
          </button>

          {hasClipboard && (
            <button
              type="button"
              onClick={() => {
                onPaste?.();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <Clipboard className="size-3.5 text-primary" />
                <span>Paste Step</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Ctrl+V</span>
            </button>
          )}

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onAutoLayout?.('LR');
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="size-3.5 text-primary" />
              <span>Auto Layout (Horizontal)</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Shift+L</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAutoLayout?.('TB');
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <Split className="size-3.5 text-muted-foreground rotate-90" />
            <span>Auto Layout (Vertical)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onFitView?.();
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5 text-muted-foreground" />
              <span>Fit to Viewport</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Shift+1</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectAll?.();
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <span>Select All Steps</span>
            <span className="text-[10px] text-muted-foreground font-mono">Ctrl+A</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onExportJson?.();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left cursor-pointer"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export Workflow JSON</span>
          </button>
        </div>
      )}
    </div>
  );
}
