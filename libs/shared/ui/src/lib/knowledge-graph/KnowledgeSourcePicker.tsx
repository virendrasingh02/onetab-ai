import type { AgentKnowledgeConfig, ContextRetrievalMode } from '@org/types';
import { cn } from '@org/utils';
import {
  BookOpen,
  Code2,
  FileText,
  FolderKanban,
  Globe,
  Layers,
  MessageSquare,
} from 'lucide-react';

export interface KnowledgeSourcePickerProps {
  value: AgentKnowledgeConfig;
  onChange: (val: AgentKnowledgeConfig) => void;
  disabled?: boolean;
  className?: string;
}

const AVAILABLE_SOURCES = [
  { id: 'workspace', label: 'Workspace Context', desc: 'Teams, members, and organization settings', icon: Layers },
  { id: 'projects', label: 'Projects & Epics', desc: 'Active projects, goals, and roadmaps', icon: FolderKanban },
  { id: 'docs', label: 'Documents & Wiki', desc: 'Specs, architecture, meeting notes, guides', icon: FileText },
  { id: 'knowledge_db', label: 'Knowledge DB & RAG', desc: 'Indexed vector documents and PDF/DOCX uploads', icon: BookOpen },
  { id: 'codebase', label: 'Codebase Graph', desc: 'Repositories, files, functions, components, API endpoints', icon: Code2 },
  { id: 'conversations', label: 'Conversations & Chat', desc: 'Channels, threads, discussions, decisions', icon: MessageSquare },
  { id: 'connected_apps', label: 'Connected Apps', desc: 'GitHub, Slack, Google Drive, integrations', icon: Globe },
];

const RETRIEVAL_MODES: Array<{ id: ContextRetrievalMode; title: string; desc: string }> = [
  { id: 'HYBRID', title: 'Hybrid (Graph + Vector)', desc: 'Best relevance: relationship graph retrieval boosted with dense vector similarity.' },
  { id: 'GRAPH', title: 'Graph Traversal Only', desc: 'Deterministic relationship traversal across connected code and work items.' },
  { id: 'VECTOR', title: 'Vector / Semantic Only', desc: 'Traditional cosine embedding search over chunked documents.' },
  { id: 'DIRECT', title: 'Direct Source Retrieval', desc: 'Direct keyword lookup in active workspace documents and tasks.' },
];

export function KnowledgeSourcePicker({
  value,
  onChange,
  disabled = false,
  className,
}: KnowledgeSourcePickerProps) {
  const toggleSource = (sourceId: string) => {
    if (disabled) return;
    const current = value.sources || [];
    const next = current.includes(sourceId)
      ? current.filter((s) => s !== sourceId)
      : [...current, sourceId];
    onChange({ ...value, sources: next });
  };

  const setMode = (mode: ContextRetrievalMode) => {
    if (disabled) return;
    onChange({ ...value, retrievalMode: mode });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 1. Knowledge Sources */}
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
            Knowledge Sources
          </h4>
          <p className="text-xs text-muted-foreground">
            Select what information this agent can retrieve and navigate across.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_SOURCES.map((source) => {
            const isChecked = (value.sources || []).includes(source.id);
            const Icon = source.icon;
            return (
              <div
                key={source.id}
                onClick={() => toggleSource(source.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={disabled ? -1 : 0}
                className={cn(
                  'flex items-start gap-3 p-2.5 rounded-lg border text-left cursor-pointer transition-all',
                  isChecked
                    ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                    : 'border-border bg-card hover:bg-muted/40 text-muted-foreground',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div
                  className={cn(
                    'p-1.5 rounded-md border shrink-0',
                    isChecked
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {source.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => toggleSource(source.id)}
                      className="size-3.5 rounded border-input text-primary focus:ring-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {source.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Retrieval Mode */}
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
            Retrieval Mode
          </h4>
          <p className="text-xs text-muted-foreground">
            Choose how knowledge is resolved and ranked for agent prompt context.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RETRIEVAL_MODES.map((mode) => {
            const isSelected = value.retrievalMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setMode(mode.id)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={disabled ? -1 : 0}
                className={cn(
                  'p-3 rounded-lg border text-left cursor-pointer transition-all space-y-1',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                    : 'border-border bg-card hover:bg-muted/40 text-muted-foreground',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    {mode.title}
                  </span>
                  <div
                    className={cn(
                      'size-3.5 rounded-full border flex items-center justify-center',
                      isSelected ? 'border-primary' : 'border-muted-foreground',
                    )}
                  >
                    {isSelected && <div className="size-1.5 rounded-full bg-primary" />}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {mode.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Context Budget & Traversal Depth */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div>
          <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
            Context Engine Fine-Tuning
          </h4>
          <p className="text-xs text-muted-foreground">
            Keep prompts compact: provide only relevant factual context to the LLM.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Maximum Context Budget</span>
              <span className="text-muted-foreground font-mono">{value.maxTokens || 2500} tokens</span>
            </div>
            <input
              type="range"
              min={500}
              max={8000}
              step={250}
              disabled={disabled}
              value={value.maxTokens || 2500}
              onChange={(e) => onChange({ ...value, maxTokens: parseInt(e.target.value, 10) })}
              className="w-full accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Smaller budgets avoid token bloat and reduce latency.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Relationship Traversal Depth</span>
              <span className="text-muted-foreground font-mono">{value.traversalDepth || 2} hops</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              disabled={disabled}
              value={value.traversalDepth || 2}
              onChange={(e) => onChange({ ...value, traversalDepth: parseInt(e.target.value, 10) })}
              className="w-full accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              1 hop = direct neighbors; 2 hops = dependencies & connected objects.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
