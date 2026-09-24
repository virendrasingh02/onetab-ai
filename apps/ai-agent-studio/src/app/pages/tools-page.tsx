import { agentsApi } from '@org/api-client';
import { Badge, Button, Input, LoadingState, toast } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  Flame,
  Globe,
  Layers,
  Loader2,
  Play,
  Search,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

export function ToolsPage() {
  const { activeWorkspace } = useStudioSession();

  // Test runner state
  const [selectedTool, setSelectedTool] = useState<string>('firecrawl_search');
  const [testParam, setTestParam] = useState<string>('Latest autonomous AI agent research');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Load MCP tool definitions
  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['studio-tools', activeWorkspace.id],
    queryFn: () => agentsApi.listMcpTools(activeWorkspace.id),
  });

  const handleTestExecute = async () => {
    if (!testParam.trim()) return;
    setIsExecuting(true);
    setTestResult(null);

    let params: any = {};
    if (selectedTool === 'firecrawl_search') {
      params = { query: testParam, limit: 3 };
    } else if (selectedTool === 'firecrawl_scrape' || selectedTool === 'firecrawl_crawl') {
      params = { url: testParam };
    } else if (selectedTool === 'firecrawl_extract') {
      params = { url: testParam, prompt: 'Extract main headers and summary' };
    } else if (selectedTool === 'search_docs') {
      params = { query: testParam };
    } else if (selectedTool === 'create_task') {
      params = { title: testParam };
    }

    try {
      const res = await agentsApi.testMcpTool(
        activeWorkspace.id,
        selectedTool,
        params,
      );
      setTestResult(res);
      toast.success(`Tool "${selectedTool}" executed successfully!`);
    } catch (err: any) {
      toast.error('Tool execution error', { description: err?.message });
      setTestResult({ error: err?.message || 'Execution error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResult = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
    toast.success('Copied output to clipboard');
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Tools & Firecrawl Registry
          </h1>
          <Badge variant="outline" className="text-xs">
            {tools.length} available
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Modular capabilities callable by agents. Includes native Firecrawl web search & scraping alongside platform MCP tools.
        </p>
      </div>

      {/* Interactive Firecrawl Playground Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Flame className="size-4 text-amber-500" />
            <span>Interactive Tool & Firecrawl Tester</span>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
            Live Sandbox
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-1">
            <label className="text-[11px] font-semibold text-foreground">
              Select Tool
            </label>
            <select
              value={selectedTool}
              onChange={(e) => {
                setSelectedTool(e.target.value);
                if (e.target.value.includes('scrape') || e.target.value.includes('crawl')) {
                  setTestParam('https://news.ycombinator.com');
                } else if (e.target.value.includes('search')) {
                  setTestParam('Autonomous AI workflow agents');
                } else {
                  setTestParam('General search query');
                }
              }}
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="firecrawl_search">firecrawl_search</option>
              <option value="firecrawl_scrape">firecrawl_scrape</option>
              <option value="firecrawl_crawl">firecrawl_crawl</option>
              <option value="firecrawl_extract">firecrawl_extract</option>
              <option value="search_docs">search_docs (Platform)</option>
              <option value="list_projects">list_projects (Platform)</option>
              <option value="list_memory">list_memory (Memory)</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-semibold text-foreground">
              Input Parameter (Query / URL)
            </label>
            <Input
              value={testParam}
              onChange={(e) => setTestParam(e.target.value)}
              placeholder="Query or URL…"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex items-end sm:col-span-1">
            <Button
              size="sm"
              onClick={() => void handleTestExecute()}
              disabled={isExecuting || !testParam.trim()}
              className="h-8 w-full gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isExecuting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
              <span>{isExecuting ? 'Calling…' : 'Test Tool'}</span>
            </Button>
          </div>
        </div>

        {/* Test Result Preview */}
        {testResult && (
          <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">
                Execution Output
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={copyResult}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-3" /> Copy JSON
              </Button>
            </div>
            <pre className="max-h-56 overflow-y-auto rounded-lg bg-surface-raised p-2.5 font-mono text-[11px] text-foreground whitespace-pre-wrap">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Reusable Tools Catalog */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">
          Registered Tool Catalog
        </h2>

        {isLoading ? (
          <LoadingState label="Loading registered tools…" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => {
              const isFirecrawl = t.name.startsWith('firecrawl');
              return (
                <div
                  key={t.name}
                  className="rounded-xl border border-border bg-surface p-4 space-y-2 shadow-2xs hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-7 items-center justify-center rounded-lg ${
                          isFirecrawl
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {isFirecrawl ? (
                          <Flame className="size-3.5" />
                        ) : (
                          <Wrench className="size-3.5" />
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {t.name}
                      </span>
                    </div>

                    <Badge
                      variant={isFirecrawl ? 'warning' : 'outline'}
                      className="text-[9px]"
                    >
                      {isFirecrawl ? 'Firecrawl' : 'MCP'}
                    </Badge>
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
