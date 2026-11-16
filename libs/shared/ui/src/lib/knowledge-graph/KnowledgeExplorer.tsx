import { useState } from 'react';
import type {
  GraphEntityType,
  GraphNodeDto,
  SubgraphDto,
} from '@org/types';
import { cn } from '@org/utils';
import {
  ExternalLink,
  Network,
  RefreshCw,
} from 'lucide-react';
import { GraphEntity } from './GraphEntity.js';
import { GraphRelationship } from './GraphRelationship.js';
import { GraphSearch } from './GraphSearch.js';

export interface KnowledgeExplorerProps {
  subgraph: SubgraphDto;
  isLoading?: boolean;
  onSearch?: (query: string, type?: GraphEntityType | 'ALL') => void;
  onSelectEntity?: (node: GraphNodeDto) => void;
  onExpandNeighbors?: (node: GraphNodeDto) => void;
  onRefresh?: () => void;
  className?: string;
}

export function KnowledgeExplorer({
  subgraph,
  isLoading = false,
  onSearch,
  onSelectEntity,
  onExpandNeighbors,
  onRefresh,
  className,
}: KnowledgeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<GraphEntityType | 'ALL'>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    subgraph.centerNodeId ?? (subgraph.nodes[0]?.id || null),
  );

  const selectedNode = subgraph.nodes.find((n) => n.id === selectedNodeId) ?? subgraph.nodes[0] ?? null;

  // Connected edges for the selected node
  const relatedEdges = selectedNode
    ? subgraph.edges.filter(
        (e) => e.sourceNodeId === selectedNode.id || e.targetNodeId === selectedNode.id,
      )
    : [];

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    onSearch?.(val, selectedType);
  };

  const handleTypeChange = (t: GraphEntityType | 'ALL') => {
    setSelectedType(t);
    onSearch?.(searchQuery, t);
  };

  const handleNodeClick = (node: GraphNodeDto) => {
    setSelectedNodeId(node.id);
    onSelectEntity?.(node);
  };

  return (
    <div className={cn('flex flex-col h-[700px] rounded-xl border border-border bg-card overflow-hidden shadow-sm', className)}>
      {/* Top Bar: Search & Status */}
      <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 max-w-xl">
          <GraphSearch
            value={searchQuery}
            onChange={handleSearchChange}
            selectedType={selectedType}
            onTypeChange={handleTypeChange}
            resultCount={subgraph.totalNodes}
            placeholder="Search code, tasks, docs, components, APIs..."
          />
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Knowledge Graph"
            >
              <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border">
            <span>{subgraph.nodes.length} nodes</span>
            <span>•</span>
            <span>{subgraph.edges.length} edges</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Split View */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left Column: Entity List (4 cols) */}
        <div className="md:col-span-4 flex flex-col min-h-0 bg-background/50">
          <div className="p-2.5 border-b border-border/80 flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Entities</span>
            <span>{subgraph.nodes.length} shown</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {subgraph.nodes.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No entities found. Index a repository or sync workspace data to explore.
              </div>
            ) : (
              subgraph.nodes.map((node) => (
                <GraphEntity
                  key={node.id}
                  node={node}
                  isSelected={node.id === selectedNode?.id}
                  onClick={() => handleNodeClick(node)}
                />
              ))
            )}
          </div>
        </div>

        {/* Center Column: Visual Subgraph Canvas (5 cols) */}
        <div className="md:col-span-5 flex flex-col min-h-0 bg-muted/10 relative p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span className="font-semibold flex items-center gap-1.5 text-foreground">
              <Network className="size-3.5 text-primary" />
              Connected Subgraph
            </span>
            {selectedNode && onExpandNeighbors && (
              <button
                type="button"
                onClick={() => onExpandNeighbors(selectedNode)}
                className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium"
              >
                Expand 1-Hop
              </button>
            )}
          </div>

          {selectedNode ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 overflow-y-auto p-2">
              {/* Primary Node Badge */}
              <div className="p-3.5 rounded-xl border-2 border-primary bg-card shadow-md max-w-xs text-center space-y-1 animate-in fade-in">
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {selectedNode.entityType}
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  {selectedNode.name}
                </h4>
                {selectedNode.identifier && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {selectedNode.identifier}
                  </p>
                )}
              </div>

              {/* Connected Relationships Tree */}
              <div className="w-full max-w-sm space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground text-center">
                  {relatedEdges.length === 0
                    ? 'No direct relationships found'
                    : `${relatedEdges.length} Connected ${relatedEdges.length === 1 ? 'Relationship' : 'Relationships'}`}
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {relatedEdges.map((edge) => (
                    <GraphRelationship
                      key={edge.id}
                      edge={edge}
                      onClick={() => {
                        const targetId = edge.sourceNodeId === selectedNode.id ? edge.targetNodeId : edge.sourceNodeId;
                        const target = subgraph.nodes.find((n) => n.id === targetId);
                        if (target) handleNodeClick(target);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Select an entity to view its connected graph.
            </div>
          )}
        </div>

        {/* Right Column: Node Details & Provenance (3 cols) */}
        <div className="md:col-span-3 flex flex-col min-h-0 bg-background/50 p-3.5 space-y-4 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Entity Details
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground font-medium">Name</span>
                <p className="font-semibold text-foreground text-sm">{selectedNode.name}</p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground font-medium">Type</span>
                <p className="font-mono text-primary font-semibold">{selectedNode.entityType}</p>
              </div>

              {selectedNode.identifier && (
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Identifier</span>
                  <p className="font-mono text-muted-foreground break-all">{selectedNode.identifier}</p>
                </div>
              )}

              {selectedNode.description && (
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">Description</span>
                  <p className="text-muted-foreground leading-relaxed">{selectedNode.description}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] text-muted-foreground font-medium">Provenance</span>
                <p className="text-foreground font-medium">{selectedNode.provenance ?? 'Deterministic Parser'}</p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground font-medium">Confidence</span>
                <p className="text-emerald-600 font-semibold">
                  {(selectedNode.confidence * 100).toFixed(0)}%
                </p>
              </div>

              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Attributes</span>
                  <pre className="p-2 rounded bg-muted/50 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto border border-border">
                    {JSON.stringify(selectedNode.properties, null, 2)}
                  </pre>
                </div>
              )}

              {selectedNode.sourceUri && (
                <div className="pt-2 border-t border-border">
                  <a
                    href={selectedNode.sourceUri.startsWith('http') ? selectedNode.sourceUri : `#/${selectedNode.sourceUri}`}
                    target={selectedNode.sourceUri.startsWith('http') ? '_blank' : '_self'}
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Open Source Item
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Select an entity to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
}
