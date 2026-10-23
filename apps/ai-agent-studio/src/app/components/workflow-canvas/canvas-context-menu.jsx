import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@org/ui';
import {
  Clipboard,
  Copy,
  Download,
  Info,
  Tag,
  Waves,
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
 *   onEditEdgeLabel?: (edge: FlowEdge) => void;
 *   onToggleEdgeAnimated?: (edge: FlowEdge) => void;
 *   onExportJson?: () => void;
 * }} CanvasContextMenuProps
 */

/** One row of the menu: icon + label, an optional shortcut hint. */
function Row({ icon: Icon, iconClass = 'text-muted-foreground', label, shortcut, variant, onSelect }) {
  return (
    <DropdownMenuItem variant={variant} onSelect={onSelect} className="gap-2 text-xs">
      {Icon ? <Icon className={`size-3.5 ${iconClass}`} /> : null}
      <span className="flex-1">{label}</span>
      {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  );
}

/**
 * Right-click menu for the workflow canvas. Built on the shared Radix dropdown
 * (keyboard navigation, focus return, Escape, collision handling) and anchored
 * to the pointer through a zero-size fixed trigger.
 * @param {CanvasContextMenuProps} props
 */
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
  onEditEdgeLabel,
  onToggleEdgeAnimated,
  onExportJson,
}) {
  const run = (fn) => () => {
    fn?.();
    onClose();
  };

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed size-0"
          style={{ left: `${x}px`, top: `${y}px` }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={0} className="min-w-[210px]">
        {targetNode ? (
          <>
            <DropdownMenuLabel className="text-2xs uppercase">
              Step: {targetNode.data?.label || targetNode.id}
            </DropdownMenuLabel>
            <Row icon={Play} iconClass="fill-current text-primary" label="Test Step Execution" onSelect={run(() => onTestNode?.(targetNode))} />
            <Row icon={Info} label="Configure Step" onSelect={run(() => onInspectNode?.(targetNode))} />
            <DropdownMenuSeparator />
            <Row icon={Copy} label="Copy" shortcut="Ctrl+C" onSelect={run(() => onCopyNode?.(targetNode))} />
            <Row icon={Scissors} label="Cut" shortcut="Ctrl+X" onSelect={run(() => onCutNode?.(targetNode))} />
            <Row icon={Copy} label="Duplicate" shortcut="Ctrl+D" onSelect={run(() => onDuplicateNode?.(targetNode))} />
            <DropdownMenuSeparator />
            <Row icon={Trash2} iconClass="" variant="destructive" label="Delete Step" shortcut="Del" onSelect={run(() => onDeleteNode?.(targetNode.id))} />
          </>
        ) : targetEdge ? (
          <>
            <DropdownMenuLabel className="text-2xs uppercase">Connection: {targetEdge.id}</DropdownMenuLabel>
            <Row icon={Sliders} iconClass="text-primary" label="Inspect Data Flow" onSelect={run(() => onInspectEdge?.(targetEdge))} />
            <Row icon={Plus} label="Insert Step Between" onSelect={run(() => onInsertNodeOnEdge?.(targetEdge))} />
            {onEditEdgeLabel && (
              <Row
                icon={Tag}
                label={targetEdge.data?.label ? 'Rename Label' : 'Add Label'}
                onSelect={run(() => onEditEdgeLabel(targetEdge))}
              />
            )}
            {onToggleEdgeAnimated && (
              <Row
                icon={Waves}
                label="Animate Connection"
                shortcut={targetEdge.data?.animated === true ? 'On' : undefined}
                onSelect={run(() => onToggleEdgeAnimated(targetEdge))}
              />
            )}
            <DropdownMenuSeparator />
            <Row icon={Trash2} iconClass="" variant="destructive" label="Delete Connection" shortcut="Del" onSelect={run(() => onDeleteEdge?.(targetEdge.id))} />
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-2xs uppercase">Canvas Actions</DropdownMenuLabel>
            <Row icon={Plus} iconClass="text-primary" label="Add Step Here…" onSelect={run(() => onAddNode?.({ x, y }))} />
            {hasClipboard && (
              <Row icon={Clipboard} iconClass="text-primary" label="Paste Step" shortcut="Ctrl+V" onSelect={run(() => onPaste?.())} />
            )}
            <DropdownMenuSeparator />
            <Row icon={Wand2} iconClass="text-primary" label="Auto Layout (Horizontal)" shortcut="Shift+L" onSelect={run(() => onAutoLayout?.('LR'))} />
            <Row icon={Split} label="Auto Layout (Vertical)" onSelect={run(() => onAutoLayout?.('TB'))} />
            <Row icon={Maximize2} label="Fit to Viewport" shortcut="Shift+1" onSelect={run(() => onFitView?.())} />
            <Row label="Select All Steps" shortcut="Ctrl+A" onSelect={run(() => onSelectAll?.())} />
            <DropdownMenuSeparator />
            <Row icon={Download} label="Export Workflow JSON" onSelect={run(() => onExportJson?.())} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
