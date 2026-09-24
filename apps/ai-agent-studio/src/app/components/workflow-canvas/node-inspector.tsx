import { Badge, Button, Input, Switch, toast } from '@org/ui';
import { cn } from '@org/utils';
import type { Node } from '@xyflow/react';
import {
  Bot,
  Brain,
  Check,
  Code2,
  Cpu,
  Flame,
  GitBranch,
  Globe,
  HelpCircle,
  Play,
  Repeat,
  Sliders,
  Sparkles,
  StopCircle,
  Trash2,
  UserCheck,
  Variable,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';

const COMMON_VARIABLES = [
  '{{input.message}}',
  '{{input.query}}',
  '{{agent.output}}',
  '{{firecrawl.markdown}}',
  '{{firecrawl.searchResults}}',
  '{{user.name}}',
  '{{workspace.name}}',
  '{{customer.email}}',
];

interface NodeInspectorProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, updatedData: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
  className?: string;
}

export function NodeInspector({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose,
  className,
}: NodeInspectorProps) {
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [targetField, setTargetField] = useState<string | null>(null);

  if (!selectedNode) {
    return (
      <div
        className={cn(
          'flex h-full w-80 flex-col items-center justify-center border-l border-border bg-surface p-6 text-center text-muted-foreground select-none',
          className,
        )}
      >
        <Sliders className="size-8 text-muted-foreground/40 mb-2" />
        <div className="text-xs font-semibold text-foreground">
          No Node Selected
        </div>
        <p className="mt-1 text-[11px] leading-relaxed">
          Click any node on the workflow canvas to configure its properties, models, prompts, and tool attachments.
        </p>
      </div>
    );
  }

  const nodeType = (selectedNode.type || '').toUpperCase();
  const data = selectedNode.data as any;
  const config = data.config || {};

  const updateConfig = (key: string, value: any) => {
    onUpdateNode(selectedNode.id, {
      ...data,
      config: {
        ...config,
        [key]: value,
      },
    });
  };

  const updateLabel = (label: string) => {
    onUpdateNode(selectedNode.id, {
      ...data,
      label,
    });
  };

  const insertVariable = (variableStr: string) => {
    if (!targetField) return;
    const current = config[targetField] || '';
    updateConfig(targetField, `${current} ${variableStr}`.trim());
    setShowVariablePicker(false);
    toast.success(`Inserted ${variableStr}`);
  };

  return (
    <div
      className={cn(
        'flex h-full w-84 flex-col border-l border-border bg-surface select-none overflow-hidden',
        className,
      )}
    >
      {/* Inspector Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-surface-raised border border-border text-primary font-bold">
            {nodeType === 'AGENT' ? (
              <Bot className="size-3.5" />
            ) : nodeType.startsWith('FIRECRAWL') ? (
              <Flame className="size-3.5 text-amber-500" />
            ) : nodeType === 'USER_APPROVAL' ? (
              <UserCheck className="size-3.5 text-rose-500" />
            ) : nodeType === 'IF_ELSE' ? (
              <GitBranch className="size-3.5 text-violet-500" />
            ) : (
              <Cpu className="size-3.5" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              Node Properties
            </div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase">
              {nodeType}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDeleteNode(selectedNode.id)}
            className="text-muted-foreground hover:text-destructive"
            title="Delete node"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Inspector Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* General: Node Label */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-foreground">
            Node Label
          </label>
          <Input
            value={data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Display label"
            className="h-8 text-xs"
          />
        </div>

        {/* 1. AGENT PROPERTIES */}
        {nodeType === 'AGENT' && (
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">
                  Instructions / System Prompt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetField('instructions');
                    setShowVariablePicker(true);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Insert Variable
                </button>
              </div>
              <textarea
                rows={4}
                value={config.instructions || ''}
                onChange={(e) => updateConfig('instructions', e.target.value)}
                placeholder="Give this agent its specialized role, guidelines and goals…"
                className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Model
              </label>
              <select
                value={config.model || 'llama3:latest'}
                onChange={(e) => updateConfig('model', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="llama3:latest">Llama 3 (Default Local / Fast)</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                <option value="mistral-large">Mistral Large</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <label className="font-semibold text-foreground">
                  Temperature: {config.temperature ?? 0.7}
                </label>
                <span className="text-muted-foreground">
                  {(config.temperature ?? 0.7) < 0.4 ? 'Strict' : 'Creative'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature ?? 0.7}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Tools & Capabilities
              </label>
              <div className="space-y-1 rounded-lg border border-border p-2">
                {[
                  { id: 'search_docs', name: 'Knowledge / Document Search' },
                  { id: 'firecrawl_search', name: 'Firecrawl Web Search' },
                  { id: 'firecrawl_scrape', name: 'Firecrawl Scrape' },
                  { id: 'create_task', name: 'Kanban Task Creator' },
                  { id: 'send_channel_message', name: 'Chat Channel Post' },
                ].map((tool) => {
                  const activeTools = (config.tools as string[]) || [];
                  const isChecked = activeTools.includes(tool.id);
                  return (
                    <label
                      key={tool.id}
                      className="flex cursor-pointer items-center justify-between py-1 text-xs hover:text-foreground"
                    >
                      <span className="text-muted-foreground">{tool.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...activeTools, tool.id]
                            : activeTools.filter((t) => t !== tool.id);
                          updateConfig('tools', next);
                        }}
                        className="rounded border-border accent-primary"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. FIRECRAWL PROPERTIES */}
        {nodeType.startsWith('FIRECRAWL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-500">
              <div className="font-semibold flex items-center gap-1.5">
                <Flame className="size-3.5" /> Firecrawl Web Integration
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Connects directly to Firecrawl API or built-in intelligent scraper to convert pages to markdown.
              </p>
            </div>

            {nodeType === 'FIRECRAWL_SEARCH' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-foreground">
                      Search Query
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetField('query');
                        setShowVariablePicker(true);
                      }}
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Use Variable
                    </button>
                  </div>
                  <Input
                    value={config.query || ''}
                    onChange={(e) => updateConfig('query', e.target.value)}
                    placeholder="e.g. {{input.query}} or AI news"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Result Limit: {config.limit || 5}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={config.limit || 5}
                    onChange={(e) => updateConfig('limit', parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                </div>
              </>
            )}

            {(nodeType === 'FIRECRAWL_SCRAPE' || nodeType === 'FIRECRAWL_CRAWL' || nodeType === 'FIRECRAWL_EXTRACT') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground">
                    Target URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetField('url');
                      setShowVariablePicker(true);
                    }}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Use Variable
                  </button>
                </div>
                <Input
                  value={config.url || ''}
                  onChange={(e) => updateConfig('url', e.target.value)}
                  placeholder="https://example.com"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {nodeType === 'FIRECRAWL_EXTRACT' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Extraction Objective / Prompt
                </label>
                <textarea
                  rows={3}
                  value={config.prompt || ''}
                  onChange={(e) => updateConfig('prompt', e.target.value)}
                  placeholder="Extract product price, features, and company contacts…"
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* 3. MCP TOOL PROPERTIES */}
        {(nodeType === 'MCP_TOOL' || nodeType === 'TOOL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                MCP Tool Name
              </label>
              <select
                value={config.toolName || 'search_docs'}
                onChange={(e) => updateConfig('toolName', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="search_docs">search_docs</option>
                <option value="create_task">create_task</option>
                <option value="create_doc">create_doc</option>
                <option value="list_projects">list_projects</option>
                <option value="list_tasks">list_tasks</option>
                <option value="send_channel_message">send_channel_message</option>
                <option value="save_memory">save_memory</option>
                <option value="list_memory">list_memory</option>
                <option value="firecrawl_search">firecrawl_search</option>
                <option value="firecrawl_scrape">firecrawl_scrape</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Timeout (seconds): {config.timeout || 30}s
              </label>
              <input
                type="range"
                min="5"
                max="120"
                value={config.timeout || 30}
                onChange={(e) => updateConfig('timeout', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}

        {/* 4. IF / ELSE PROPERTIES */}
        {nodeType === 'IF_ELSE' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Variable to Compare
              </label>
              <Input
                value={config.variable || ''}
                onChange={(e) => updateConfig('variable', e.target.value)}
                placeholder="e.g. status or price"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Operator
              </label>
              <select
                value={config.operator || 'equals'}
                onChange={(e) => updateConfig('operator', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="equals">Equals (==)</option>
                <option value="not_equals">Not Equals (!=)</option>
                <option value="contains">Contains substring</option>
                <option value="greater_than">Greater than (&gt;)</option>
                <option value="less_than">Less than (&lt;)</option>
                <option value="is_empty">Is Empty</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Expected Value
              </label>
              <Input
                value={config.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="e.g. true or approved"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* 5. HUMAN APPROVAL PROPERTIES */}
        {nodeType === 'USER_APPROVAL' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Approval Action Name
              </label>
              <Input
                value={config.action || ''}
                onChange={(e) => updateConfig('action', e.target.value)}
                placeholder="e.g. Approve sending outbound email"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Description / Context for Approver
              </label>
              <textarea
                rows={3}
                value={config.description || ''}
                onChange={(e) => updateConfig('description', e.target.value)}
                placeholder="Explain why this operation needs human approval…"
                className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-foreground">
                Strict Gate (pause execution)
              </span>
              <input
                type="checkbox"
                checked={config.required !== false}
                onChange={(e) => updateConfig('required', e.target.checked)}
                className="rounded border-border accent-primary"
              />
            </div>
          </div>
        )}

        {/* 6. TRANSFORM / TEMPLATE PROPERTIES */}
        {nodeType === 'TRANSFORM' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">
                  Template
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetField('template');
                    setShowVariablePicker(true);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Insert Variable
                </button>
              </div>
              <textarea
                rows={5}
                value={config.template || ''}
                onChange={(e) => updateConfig('template', e.target.value)}
                placeholder="Draft formatted output: {{agent.output}} &#10;Source: {{firecrawl.url}}"
                className="w-full font-mono rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Variable Picker Modal */}
        {showVariablePicker && (
          <div className="rounded-xl border border-primary/30 bg-surface-raised p-3 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Select Variable
              </span>
              <button
                type="button"
                onClick={() => setShowVariablePicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {COMMON_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded px-2 py-1 text-left font-mono text-[11px] text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
