import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Download,
  Maximize2,
  Play,
  Plus,
  Trash2,
  Wand2,
  Info,
} from 'lucide-react';

export function CanvasContextMenu({
  isOpen,
  x,
  y,
  targetNode = null,
  onClose,
  onAutoLayout,
  onFitView,
  onAddNode,
  onDuplicateNode,
  onDeleteNode,
  onTestNode,
  onInspectNode,
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
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-border bg-surface/95 backdrop-blur-md p-1.5 shadow-xl text-xs text-foreground select-none animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {targetNode ? (
        // Node Context Actions
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border/60 mb-1">
            Node: {targetNode.data?.label || targetNode.id}
          </div>

          <button
            type="button"
            onClick={() => {
              onTestNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
          >
            <Play className="size-3.5 fill-current text-primary" />
            <span>Test Node Execution</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onInspectNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Info className="size-3.5 text-muted-foreground" />
            <span>Configure Parameters</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicateNode?.(targetNode);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate Node</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              onDeleteNode?.(targetNode.id);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Node</span>
          </button>
        </div>
      ) : (
        // Canvas Background Actions
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
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left font-medium"
          >
            <Plus className="size-3.5 text-primary" />
            <span>Add Node Here…</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAutoLayout?.();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Wand2 className="size-3.5 text-primary" />
            <span>Auto Layout Graph</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onFitView?.();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Maximize2 className="size-3.5 text-muted-foreground" />
            <span>Fit to Viewport</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportJson?.();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export Workflow JSON</span>
          </button>
        </div>
      )}
    </div>
  );
}
