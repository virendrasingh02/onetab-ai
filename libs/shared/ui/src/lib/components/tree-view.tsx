import { cn } from '@org/utils';
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Search,
} from 'lucide-react';
import {
  useState,
  type ReactNode,
} from 'react';

export interface TreeNode {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: TreeNode[];
  badge?: ReactNode;
  disabled?: boolean;
  metadata?: Record<string, any>;
}

export interface TreeViewProps {
  data: TreeNode[];
  selectedId?: string;
  defaultExpandedIds?: string[];
  onSelect?: (node: TreeNode) => void;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function TreeView({
  data,
  selectedId,
  defaultExpandedIds = [],
  onSelect,
  enableSearch = true,
  searchPlaceholder = 'Filter tree...',
  className,
}: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(defaultExpandedIds));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const renderNode = (node: TreeNode, depth = 0): ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedIds.has(node.id) || Boolean(searchQuery);
    const isSelected = selectedId === node.id;

    // Filter matching
    if (searchQuery) {
      const matchSelf = node.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChildren = node.children?.some((c) =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      if (!matchSelf && !matchChildren) return null;
    }

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          onClick={() => !node.disabled && onSelect?.(node)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={cn(
            'group flex items-center justify-between gap-1.5 rounded-btn py-1.5 pr-2 text-xs font-medium text-foreground/80 cursor-pointer',
            'transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground',
            isSelected && 'bg-selected text-primary-text font-semibold',
            node.disabled && 'pointer-events-none opacity-50',
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="size-4 shrink-0 rounded-xs hover:bg-surface-raised flex items-center justify-center text-muted-foreground"
              >
                {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}

            {node.icon ? (
              <span className="size-4 shrink-0 text-muted-foreground [&_svg]:size-4">
                {node.icon}
              </span>
            ) : hasChildren ? (
              isExpanded ? (
                <FolderOpen className="size-4 shrink-0 text-primary/80" />
              ) : (
                <Folder className="size-4 shrink-0 text-primary/80" />
              )
            ) : (
              <File className="size-4 shrink-0 text-muted-foreground" />
            )}

            <span className="truncate">{node.label}</span>
          </div>

          {node.badge && <div className="shrink-0">{node.badge}</div>}
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col gap-2 rounded-card border border-border bg-surface p-3', className)}>
      {enableSearch && (
        <div className="relative mb-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 w-full rounded-input border border-input bg-surface pl-8 pr-2.5 text-xs text-foreground placeholder:text-subtle outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-96 scrollbar-subtle">
        {data.map((rootNode) => renderNode(rootNode, 0))}
      </div>
    </div>
  );
}
