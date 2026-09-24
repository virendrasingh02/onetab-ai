import { agentsApi, aiExecutionsApi } from '@org/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, LoadingState } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  Play,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STUDIO_TEMPLATES } from '../data/templates.js';
import { useStudioSession } from '../session-guard.js';

export function OverviewPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();

  // Load workspace agents
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
  });

  // Load workspace execution logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['workspace-logs', activeWorkspace.id],
    queryFn: () => agentsApi.workspaceLogs(activeWorkspace.id),
  });

  const publishedAgents = agents.filter(
    (a) => (a.configuration as any)?.status === 'published',
  );
  const draftAgents = agents.filter(
    (a) => (a.configuration as any)?.status !== 'published',
  );
  const successfulRuns = logs.filter((l) => l.status === 'SUCCESS').length;
  const successRate =
    logs.length > 0 ? Math.round((successfulRuns / logs.length) * 100) : 100;

  if (isLoadingAgents) {
    return <LoadingState label="Loading Agent Studio dashboard…" />;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-xs">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>AI Agent Studio — Enterprise Orchestration</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Build, Test & Deploy Intelligent Autonomous Agents
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Construct visual node workflows, attach Firecrawl web extraction and MCP tools, implement human approval checkpoints, and publish immutable agent versions to {activeWorkspace.name}.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              size="sm"
              onClick={() => navigate('/agents?create=blank')}
              className="gap-1.5 font-semibold"
            >
              <Plus className="size-4" /> Create Blank Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/templates')}
              className="gap-1.5"
            >
              <Layers className="size-4" /> Explore Templates
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Agents</span>
            <Bot className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {agents.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {publishedAgents.length} published, {draftAgents.length} drafts
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Published Versions</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {publishedAgents.length}
          </div>
          <div className="mt-1 text-[11px] text-emerald-500 font-medium">
            Active in workspace
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Executions</span>
            <Activity className="size-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {logs.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Across workspace runs
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Success Rate</span>
            <Zap className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {successRate}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {successfulRuns} successful turns
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Agents + Popular Templates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Recent Agents */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                Recent Agents
              </h2>
            </div>
            <Link
              to="/agents"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span>View all ({agents.length})</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-muted-foreground">
              <Bot className="size-10 text-muted-foreground/30 mb-2" />
              <div className="text-sm font-semibold text-foreground">
                No Agents Created Yet
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Start by creating your first AI agent from scratch or choosing a pre-built Firecrawl web research template.
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/agents?create=blank')}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-3.5" /> Create Agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {agents.slice(0, 4).map((agent) => {
                const config = (agent.configuration as any) || {};
                const isPublished = config.status === 'published';
                const version = config.currentVersion ? `v${config.currentVersion}.0.0` : 'v1.0.0-draft';
                const toolsCount = (agent.tools ? JSON.parse(agent.tools) : []).length;

                return (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    className="group flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/50 hover:shadow-md hover:bg-surface-raised/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                            <Bot className="size-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                              {agent.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {agent.role || 'Assistant'}
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={isPublished ? 'success' : 'outline'}
                          className="text-[10px]"
                        >
                          {isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                        {agent.description || agent.systemPrompt || 'No description set'}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground font-mono">
                      <span>{version}</span>
                      <span>{agent.model || 'llama3'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Executions Log Preview */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-sky-500" />
                <h3 className="text-xs font-bold text-foreground">
                  Recent Executions
                </h3>
              </div>
              <Link
                to="/executions"
                className="text-xs text-primary hover:underline"
              >
                View all executions
              </Link>
            </div>

            {logs.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No execution logs recorded yet. Run a test turn to populate telemetry.
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`size-2 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : 'bg-destructive'
                        }`}
                      />
                      <span className="font-semibold text-foreground truncate">
                        {log.agentName || 'Agent Run'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      <span>{log.durationMs}ms</span>
                      <Badge
                        variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}
                        className="text-[10px]"
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Recommended Templates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold text-foreground">
                Templates
              </h2>
            </div>
            <Link
              to="/templates"
              className="text-xs font-medium text-primary hover:underline"
            >
              All 14
            </Link>
          </div>

          <div className="space-y-3">
            {STUDIO_TEMPLATES.slice(0, 4).map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => navigate(`/templates?use=${tpl.id}`)}
                className="group flex cursor-pointer flex-col rounded-xl border border-border bg-surface p-3.5 transition-all hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {tpl.name}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {tpl.tags[0]}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {tpl.description}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{tpl.nodes.length} nodes</span>
                  <span className="text-primary font-semibold group-hover:underline">
                    Use Template →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
