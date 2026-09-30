import { Button, CodeBlock, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import type { Node } from '@xyflow/react';
import {
  Bot,
  Cpu,
  Flame,
  GitBranch,
  Shield,
  Sliders,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { workflowService } from '../../services/workflowService.js';

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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

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
            ) : nodeType === 'AI_GUARDRAIL' ? (
              <Shield className="size-3.5 text-emerald-500" />
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

        {/* 5b. AI GUARDRAIL PROPERTIES */}
        {nodeType === 'AI_GUARDRAIL' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="font-semibold flex items-center gap-1.5">
                <Shield className="size-3.5 text-emerald-500" /> Security & Guardrail Filter
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Applies automated PII redaction, token budgets, and prompt injection defenses to protect outputs.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Guardrail Mode
              </label>
              <select
                value={config.policy || 'pii-redaction'}
                onChange={(e) => updateConfig('policy', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="pii-redaction">PII Redaction & Sanitization</option>
                <option value="cost-cap">Cost & Token Budget Cap</option>
                <option value="prompt-injection">Prompt Injection Defense</option>
                <option value="content-safety">Content Safety & Toxicity Filter</option>
              </select>
            </div>

            {config.policy !== 'cost-cap' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Policy Enforcement Action
                </label>
                <select
                  value={config.action || 'redact'}
                  onChange={(e) => updateConfig('action', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="redact">Redact (Replace sensitive tokens with [redacted])</option>
                  <option value="block">Block (Halt execution on policy violation)</option>
                  <option value="warn">Warn (Record finding in audit trace without modifying payload)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Max Tokens Cap Per Run: {config.maxTokens || 4096}
                </label>
                <Input
                  type="number"
                  min={100}
                  max={64000}
                  value={config.maxTokens || 4096}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value, 10) || 4096)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Hard cap applied by execution engine</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Custom Banned Words / RegEx (Optional)
              </label>
              <Input
                value={config.bannedPhrases || ''}
                onChange={(e) => updateConfig('bannedPhrases', e.target.value)}
                placeholder="secret_key, internal_ip, password"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* 6. TRANSFORM / TEMPLATE PROPERTIES */}
        {(nodeType === 'TRANSFORM' || nodeType === 'PROMPT_TEMPLATE') && (
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

        {/* 7. TRIGGER CONFIGURATION */}
        {nodeType.startsWith('TRIGGER') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Event Trigger Configuration
            </div>
            {nodeType === 'TRIGGER_SCHEDULE' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Cron Expression</label>
                <Input
                  value={config.cron || '0 9 * * 1-5'}
                  onChange={(e) => updateConfig('cron', e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Every weekday at 09:00 UTC</span>
              </div>
            )}
            {nodeType === 'TRIGGER_WEBHOOK' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">HTTP Method</label>
                <select
                  value={config.httpMethod || 'POST'}
                  onChange={(e) => updateConfig('httpMethod', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
                >
                  <option value="POST">POST (Recommended)</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            )}
            {nodeType === 'TRIGGER_CHAT' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Welcome Greeting</label>
                <Input
                  value={config.welcomeGreeting || 'Hi! How can I assist you today?'}
                  onChange={(e) => updateConfig('welcomeGreeting', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* 8. KNOWLEDGE & RETRIEVAL CONFIGURATION */}
        {(nodeType === 'KB_SEARCH' || nodeType === 'VECTOR_SEARCH' || nodeType === 'KNOWLEDGE_RETRIEVAL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Knowledge Base</label>
              <select
                value={config.knowledgeBaseId || 'kb-support-docs'}
                onChange={(e) => updateConfig('knowledgeBaseId', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
              >
                <option value="kb-support-docs">Product Documentation & FAQs</option>
                <option value="kb-api-reference">API Contracts & SDK Guides</option>
                <option value="kb-legal-terms">Compliance & Terms of Service</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Top Chunks (Top-K): {config.topK || 4}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={config.topK || 4}
                onChange={(e) => updateConfig('topK', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Min Similarity Score: {config.minScore || 0.75}</label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={config.minScore || 0.75}
                onChange={(e) => updateConfig('minScore', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}

        {/* 9. CODE EXECUTION CONFIGURATION */}
        {(nodeType === 'CODE_JAVASCRIPT' || nodeType === 'CODE' || nodeType === 'CODE_PYTHON') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Sandboxed Code</label>
              <textarea
                rows={8}
                value={config.code || '// Custom transformation\nreturn input;'}
                onChange={(e) => updateConfig('code', e.target.value)}
                className="w-full font-mono rounded-md border border-border bg-zinc-950 text-zinc-100 p-2.5 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* 10. HTTP REQUEST & DATABASE */}
        {nodeType === 'HTTP_REQUEST' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">HTTP Method</label>
              <select
                value={config.method || 'GET'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Endpoint URL</label>
              <Input
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.example.com/data"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {nodeType === 'DB_QUERY' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">SQL Query</label>
              <textarea
                rows={4}
                value={config.query || 'SELECT * FROM records LIMIT 20;'}
                onChange={(e) => updateConfig('query', e.target.value)}
                className="w-full font-mono rounded-md border border-border bg-zinc-950 text-zinc-100 p-2.5 text-xs"
              />
            </div>
          </div>
        )}

        {/* 11. ANNOTATIONS: STICKY NOTE & GROUP */}
        {(nodeType === 'STICKY_NOTE' || nodeType === 'NOTE') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Note Content</label>
              <textarea
                rows={6}
                value={config.note || ''}
                onChange={(e) => updateConfig('note', e.target.value)}
                placeholder="Document your architecture or steps here…"
                className="w-full rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        {nodeType === 'GROUP' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Stage Title</label>
              <Input
                value={config.label || ''}
                onChange={(e) => updateConfig('label', e.target.value)}
                placeholder="e.g. Data Ingestion Stage"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Test Node Action & Simulation Preview */}
        <div className="pt-4 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Node Execution Sandbox
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={async () => {
                setIsTesting(true);
                setTestResult(null);
                try {
                  const res = await workflowService.simulateTestNode(selectedNode, config);
                  setTestResult(res);
                  toast.success(`Node "${selectedNode.data?.label || selectedNode.id}" executed successfully`);
                } catch {
                  toast.error('Node test failed');
                } finally {
                  setIsTesting(false);
                }
              }}
              loading={isTesting}
              className="gap-1 text-xs"
            >
              <Cpu className="size-3 text-emerald-500" />
              Test Node
            </Button>
          </div>

          {testResult && (
            <div className="space-y-1 font-mono text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground pb-1">
                <span className="text-emerald-500 font-bold">{testResult.status}</span>
                <span>{testResult.latencyMs}ms</span>
              </div>
              <CodeBlock
                variant="compact"
                language="json"
                code={JSON.stringify(testResult.output, null, 2)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
