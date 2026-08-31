import type { CardComponentNode } from '@org/types';
import { cn } from '@org/utils';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
  Lock,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';

export interface ComponentTreeProps {
  rootNode: CardComponentNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onToggleLockNode: (nodeId: string) => void;
}

export function ComponentTree({
  rootNode,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onDuplicateNode,
  onToggleLockNode,
}: ComponentTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTreeNode = (node: CardComponentNode, depth = 0): React.ReactNode => {
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsed[node.id];

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectNode(node.id)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={cn(
            'group flex items-center justify-between py-1 px-2 rounded-lg text-xs transition-all cursor-pointer my-0.5',
            isSelected
              ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
              : 'text-foreground hover:bg-accent/70',
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(node.id, e)}
                className="p-0.5 hover:bg-accent rounded"
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>
            ) : (
              <span className="size-3.5 inline-block" />
            )}

            <Layers className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">
              {node.name || node.type} <span className="opacity-60 text-[10px]">({node.id})</span>
            </span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
              isSelected && 'opacity-100',
            )}
          >
            <button
              type="button"
              title={node.locked ? 'Unlock component' : 'Lock component'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLockNode(node.id);
              }}
              className="p-1 hover:bg-accent rounded"
            >
              {node.locked ? <Lock className="size-3 text-warning-text" /> : <Unlock className="size-3 opacity-60" />}
            </button>

            <button
              type="button"
              title="Duplicate component"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateNode(node.id);
              }}
              className="p-1 hover:bg-accent rounded"
            >
              <Copy className="size-3" />
            </button>

            {node.id !== rootNode.id && (
              <button
                type="button"
                title="Delete component"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode(node.id);
                }}
                className="p-1 hover:bg-destructive/20 text-destructive-text rounded"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="border-l border-border/40 ml-3">
            {node.children?.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border/60">
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-foreground block">Component Hierarchy</span>
          <span className="text-[10px] text-muted-foreground">Select, reorder, or duplicate nodes</span>
        </div>
      </div>
      <div className="p-2 overflow-y-auto flex-1">
        {renderTreeNode(rootNode)}
      </div>
    </div>
  );
}
