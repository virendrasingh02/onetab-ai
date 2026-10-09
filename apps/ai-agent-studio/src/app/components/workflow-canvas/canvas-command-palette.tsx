import { Dialog, DialogContent, DialogTitle } from '@org/ui';
import { cn } from '@org/utils';
import type { Node } from '@xyflow/react';
import {
  Bot,
  CheckCircle2,
  Download,
  Eye,
  Lock,
  Maximize2,
  Play,
  Plus,
  Redo2,
  Save,
  Search,
  ShieldCheck,
  Undo2,
  Unlock,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_NODES, type CatalogNodeItem } from './node-library.js';

interface CanvasCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  onFocusNode: (nodeId: string) => void;
  onAddNode: (item: CatalogNodeItem) => void;
  onAutoLayout: (dir: 'LR' | 'TB') => void;
  onTestRun: () => void;
  onValidate: () => void;
  onSave: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  isLocked: boolean;
  onToggleLock: () => void;
  onTogglePresentation?: () => void;
  onExportJson: () => void;
}

interface CommandOption {
  id: string;
  category: string;
  label: string;
  subtitle?: string;
  icon: any;
  action: () => void;
  shortcut?: string;
}

export function CanvasCommandPalette({
  isOpen,
  onClose,
  nodes,
  onFocusNode,
  onAddNode,
  onAutoLayout,
  onTestRun,
  onValidate,
  onSave,
  onPublish,
  onUndo,
  onRedo,
  onFitView,
  isLocked,
  onToggleLock,
  onTogglePresentation,
  onExportJson,
}: CanvasCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo<CommandOption[]>(() => {
    const list: CommandOption[] = [
      {
        id: 'cmd-layout-lr',
        category: 'Layout',
        label: 'Auto Layout Workflow (Horizontal LR)',
        subtitle: 'Tidy graph nodes from left to right',
        icon: Wand2,
        shortcut: 'Shift+L',
        action: () => onAutoLayout('LR'),
      },
      {
        id: 'cmd-layout-tb',
        category: 'Layout',
        label: 'Auto Layout Workflow (Vertical TB)',
        subtitle: 'Tidy graph nodes from top to bottom',
        icon: Wand2,
        action: () => onAutoLayout('TB'),
      },
      {
        id: 'cmd-fit-view',
        category: 'View',
        label: 'Fit View to Screen',
        subtitle: 'Frame entire graph in canvas view',
        icon: Maximize2,
        shortcut: 'Shift+1',
        action: onFitView,
      },
      {
        id: 'cmd-test-run',
        category: 'Execution',
        label: 'Run Test Execution',
        subtitle: 'Execute workflow simulation with live trace',
        icon: Play,
        action: onTestRun,
      },
      {
        id: 'cmd-validate',
        category: 'Quality',
        label: 'Validate Workflow Graph',
        subtitle: 'Inspect structure for cycles, orphaned nodes, and missing credentials',
        icon: ShieldCheck,
        action: onValidate,
      },
      {
        id: 'cmd-save',
        category: 'Workflow',
        label: 'Save Workflow Changes',
        subtitle: 'Persist canvas graph to backend server',
        icon: Save,
        shortcut: 'Ctrl+S',
        action: onSave,
      },
      {
        id: 'cmd-publish',
        category: 'Workflow',
        label: 'Publish Live Version',
        subtitle: 'Create immutable release version',
        icon: CheckCircle2,
        shortcut: 'Ctrl+Shift+P',
        action: onPublish,
      },
      {
        id: 'cmd-undo',
        category: 'Edit',
        label: 'Undo Previous Edit',
        subtitle: 'Revert graph action',
        icon: Undo2,
        shortcut: 'Ctrl+Z',
        action: onUndo,
      },
      {
        id: 'cmd-redo',
        category: 'Edit',
        label: 'Redo Next Edit',
        subtitle: 'Re-apply reverted action',
        icon: Redo2,
        shortcut: 'Ctrl+Y',
        action: onRedo,
      },
      {
        id: 'cmd-lock',
        category: 'Canvas',
        label: isLocked ? 'Unlock Canvas' : 'Lock Canvas (Prevent Changes)',
        subtitle: isLocked ? 'Enable dragging and editing' : 'Freeze nodes in place',
        icon: isLocked ? Unlock : Lock,
        action: onToggleLock,
      },
      ...(onTogglePresentation
        ? [
            {
              id: 'cmd-presentation',
              category: 'View',
              label: 'Toggle Presentation Mode',
              subtitle: 'Hide all panels for a clean full-screen presentation',
              icon: Eye,
              action: onTogglePresentation,
            },
          ]
        : []),
      {
        id: 'cmd-export',
        category: 'File',
        label: 'Export Workflow as JSON',
        subtitle: 'Download graph definition and node configurations',
        icon: Download,
        action: onExportJson,
      },
    ];

    return list;
  }, [
    onAutoLayout,
    onFitView,
    onTestRun,
    onValidate,
    onSave,
    onPublish,
    onUndo,
    onRedo,
    isLocked,
    onToggleLock,
    onTogglePresentation,
    onExportJson,
  ]);

  // Canvas nodes matching query
  const matchingNodes = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes
      .filter((n) => {
        const label = String(n.data?.label || n.type || '').toLowerCase();
        const subtitle = String(n.data?.subtitle || '').toLowerCase();
        return label.includes(q) || subtitle.includes(q) || n.id.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [nodes, query]);

  // Catalog nodes matching query
  const matchingCatalog = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CATALOG_NODES.filter((c) => {
      return (
        c.label.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    }).slice(0, 6);
  }, [query]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const allItems = useMemo(() => {
    const list: Array<{ type: 'node' | 'cmd' | 'catalog'; item: any }> = [];
    matchingNodes.forEach((n) => list.push({ type: 'node', item: n }));
    filteredCommands.forEach((c) => list.push({ type: 'cmd', item: c }));
    matchingCatalog.forEach((c) => list.push({ type: 'catalog', item: c }));
    return list;
  }, [matchingNodes, filteredCommands, matchingCatalog]);

  const handleSelectIndex = (index: number) => {
    const entry = allItems[index];
    if (!entry) return;
    onClose();
    if (entry.type === 'node') {
      onFocusNode(entry.item.id);
    } else if (entry.type === 'cmd') {
      entry.item.action();
    } else if (entry.type === 'catalog') {
      onAddNode(entry.item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectIndex(selectedIndex);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl overflow-hidden p-0 gap-0 rounded-2xl border-border bg-surface/98 backdrop-blur-xl shadow-2xl">
        <DialogTitle className="sr-only">Workflow Command Palette</DialogTitle>

        {/* Input Bar */}
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
          <Search className="size-4.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search nodes, or add new steps…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <kbd className="rounded border border-border/60 bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* List of Results */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {/* 1. Canvas Nodes on search */}
          {matchingNodes.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Nodes on Canvas
              </div>
              {matchingNodes.map((n, i) => {
                const globalIndex = i;
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelectIndex(globalIndex)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors text-left cursor-pointer',
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-raised text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="size-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{String(n.data?.label || n.id)}</div>
                        <div className={cn('text-[10px] truncate', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {String(n.data?.subtitle || n.type || '')}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">Focus Step</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Commands */}
          {filteredCommands.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Commands & Actions
              </div>
              {filteredCommands.map((c, i) => {
                const globalIndex = matchingNodes.length + i;
                const isSelected = selectedIndex === globalIndex;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectIndex(globalIndex)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors text-left cursor-pointer',
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-raised text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                        <Icon className="size-3.5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.label}</div>
                        {c.subtitle && (
                          <div className={cn('text-[10px] truncate', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            {c.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    {c.shortcut && (
                      <kbd className={cn('rounded border px-1.5 py-0.5 text-[10px] font-mono shrink-0', isSelected ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground' : 'border-border/60 bg-surface-raised text-muted-foreground')}>
                        {c.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Catalog Nodes to Insert */}
          {matchingCatalog.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Add Node to Canvas
              </div>
              {matchingCatalog.map((cat, i) => {
                const globalIndex = matchingNodes.length + filteredCommands.length + i;
                const isSelected = selectedIndex === globalIndex;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.type + i}
                    type="button"
                    onClick={() => handleSelectIndex(globalIndex)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors text-left cursor-pointer',
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-raised text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {Icon ? <Icon className="size-3.5 text-primary" /> : <Plus className="size-3.5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">Add {cat.label}</div>
                        <div className={cn('text-[10px] truncate', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {cat.subtitle || cat.description}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">Insert</span>
                  </button>
                );
              })}
            </div>
          )}

          {allItems.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands, nodes, or steps found for "{query}".
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/80 px-4 py-2 text-[11px] text-muted-foreground bg-surface-raised/40">
          <span>Navigate with ↑ ↓, press Enter to execute</span>
          <span>AI Agent Studio</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
