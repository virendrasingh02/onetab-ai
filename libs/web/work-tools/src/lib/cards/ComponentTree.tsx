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

  const renderTreeNode = (
    node: CardComponentNode,
    depth = 0,
  ): React.ReactNode => {
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsed[node.id];

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectNode(node.id)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={cn(
            'group py-1 px-2 text-xs my-0.5 flex cursor-pointer items-center justify-between rounded-lg transition-all',
            isSelected
              ? 'font-semibold shadow-2xs bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-accent/70',
          )}
        >
          <div className="gap-1.5 min-w-0 flex items-center">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(node.id, e)}
                className="p-0.5 rounded hover:bg-accent"
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
              {node.name || node.type}{' '}
              <span className="text-2xs opacity-60">({node.id})</span>
            </span>
          </div>

          <div
            className={cn(
              'gap-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100',
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
              className="p-1 rounded hover:bg-accent"
            >
              {node.locked ? (
                <Lock className="size-3 text-warning-text" />
              ) : (
                <Unlock className="size-3 opacity-60" />
              )}
            </button>

            <button
              type="button"
              title="Duplicate component"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateNode(node.id);
              }}
              className="p-1 rounded hover:bg-accent"
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
                className="p-1 rounded text-destructive-text hover:bg-destructive/20"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="ml-3 border-l border-border/40">
            {node.children?.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-surface">
      <div className="p-3 flex items-center justify-between border-b border-border/60">
        <div>
          <span className="text-xs font-bold block text-foreground">
            Component Hierarchy
          </span>
          <span className="text-2xs text-muted-foreground">
            Select, reorder, or duplicate nodes
          </span>
        </div>
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
        {renderTreeNode(rootNode)}
      </div>
    </div>
  );
}
