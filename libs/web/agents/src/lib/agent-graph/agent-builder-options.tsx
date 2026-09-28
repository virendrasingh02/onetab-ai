import {
  agentsApi,
  aiApi,
  aiEntitiesApi,
  channelApi,
  knowledgeApi,
  mcpApi,
  queryKeys,
  workToolsApi,
} from '@org/api-client';
import { mcpToolFunctionName, READ_ONLY_AGENT_TOOLS } from '@org/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { OptionSource } from './agent-graph-model.js';

export interface BuilderOption {
  value: string;
  label: string;
  hint?: string;
  /** For grouping in the picker, and for `filterBy` narrowing (models by provider). */
  group?: string;
}

export type BuilderOptions = Record<OptionSource, BuilderOption[]>;

const EMPTY: BuilderOptions = {
  tools: [],
  knowledgeBases: [],
  channels: [],
  projects: [],
  providers: [],
  models: [],
  agents: [],
  coworkers: [],
  mcpServerTools: [],
};

const OptionsContext = createContext<{ options: BuilderOptions; isLoading: boolean }>({
  options: EMPTY,
  isLoading: false,
});

/**
 * Loads the lists the builder's pickers offer — the tools the runtime can
 * actually call (built-ins plus connected MCP servers), the workspace's
 * knowledge bases, channels, projects, and configured model providers — once
 * per builder, shared by every node's inspector.
 */
export function AgentBuilderOptionsProvider({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  const enabled = Boolean(workspaceId);
  const ws = workspaceId ?? '';

  const builtins = useQuery({
    queryKey: queryKeys.agents.tools(ws),
    queryFn: () => agentsApi.listMcpTools(ws),
    enabled,
    staleTime: 5 * 60_000,
  });
  const mcp = useQuery({
    queryKey: queryKeys.mcp.connections(ws),
    queryFn: () => mcpApi.listConnections(ws),
    enabled,
  });
  const knowledge = useQuery({
    queryKey: queryKeys.knowledge.list(ws),
    queryFn: () => knowledgeApi.list(ws),
    enabled,
  });
  const channels = useQuery({
    queryKey: queryKeys.channels.list(ws, false),
    queryFn: () => channelApi.list(ws, false),
    enabled,
    staleTime: 60_000,
  });
  const projects = useQuery({
    queryKey: queryKeys.workTools.projects(ws),
    queryFn: () => workToolsApi.projects(ws),
    enabled,
    staleTime: 60_000,
  });
  const entities = useQuery({
    queryKey: ['ai-entities', ws, 'all'],
    queryFn: () => aiEntitiesApi.list(ws),
    enabled,
    staleTime: 60_000,
  });
  const providers = useQuery({
    queryKey: ['ai-providers', ws],
    queryFn: () => aiApi.getProviders(ws),
    enabled,
    staleTime: 60_000,
  });

  const value = useMemo(() => {
    const options: BuilderOptions = {
      tools: [
        ...(builtins.data ?? []).map((tool) => ({
          value: tool.name,
          label: tool.name,
          hint: tool.description,
          group: READ_ONLY_AGENT_TOOLS.includes(tool.name) ? 'Reads' : 'Changes things',
        })),
        ...(mcp.data ?? [])
          .filter((conn) => conn.status === 'CONNECTED' && conn.isEnabled)
          .flatMap((conn) =>
            conn.discoveredToolsJson.map((tool) => ({
              value: mcpToolFunctionName(conn.id, tool.name),
              label: `${conn.name}: ${tool.name}`,
              hint: tool.description,
              group: 'MCP servers',
            })),
          ),
      ],
      knowledgeBases: (knowledge.data ?? []).map((kb) => ({
        value: kb.id,
        label: kb.name,
        hint: `${kb._count?.documents ?? 0} documents`,
      })),
      channels: (channels.data ?? []).map((channel) => ({ value: channel.id, label: channel.name })),
      projects: (projects.data ?? []).map((project) => ({ value: project.id, label: project.name })),
      providers: (providers.data ?? [])
        .filter((p) => p.enabled !== false)
        .map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.configured ? undefined : 'Not configured — add a key in Settings → AI providers',
          group: p.configured ? 'Configured' : 'Not configured',
        })),
      models: (providers.data ?? []).flatMap((p) =>
        (p.models ?? [])
          .filter((m) => m.enabled)
          .map((m) => ({ value: m.model, label: m.name, group: p.id })),
      ),
      agents: (entities.data ?? [])
        .filter((e) => e.type === 'agent')
        .map((e) => ({ value: e.id, label: e.name, hint: e.isActive ? e.role : 'Paused' })),
      coworkers: (entities.data ?? [])
        .filter((e) => e.type === 'coworker')
        .map((e) => ({ value: e.id, label: e.name, hint: e.isActive ? e.role : 'Paused' })),
      mcpServerTools: (mcp.data ?? [])
        .filter((conn) => conn.status === 'CONNECTED' && conn.isEnabled)
        .flatMap((conn) =>
          conn.discoveredToolsJson.map((tool) => ({
            value: `${conn.id}::${tool.name}`,
            label: `${conn.name}: ${tool.name}`,
            hint: tool.description,
            group: conn.name,
          })),
        ),
    };
    return {
      options,
      isLoading: builtins.isLoading || knowledge.isLoading || providers.isLoading,
    };
  }, [
    builtins.data,
    builtins.isLoading,
    mcp.data,
    knowledge.data,
    knowledge.isLoading,
    channels.data,
    projects.data,
    providers.data,
    providers.isLoading,
    entities.data,
  ]);

  return <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>;
}

export function useAgentBuilderOptions() {
  return useContext(OptionsContext);
}

const EMPTY_SOURCE_TEXT: Record<OptionSource, string> = {
  tools: 'No tools available.',
  knowledgeBases: 'No knowledge bases yet — create one in AI Workspace → Knowledge.',
  channels: 'No channels you can post in.',
  projects: 'No projects yet.',
  providers: 'No model providers are enabled — check Settings → AI providers.',
  models: 'No models for this provider.',
  agents: 'No agents yet — build one in AI Workspace → Agents.',
  coworkers: 'No coworkers yet.',
  mcpServerTools: 'No MCP server tools — connect a server in AI Workspace → Tools.',
};

/**
 * A picker over one of the workspace's real lists. A saved value that is no
 * longer offered — a deleted knowledge base, a disconnected MCP tool — stays
 * visible and is marked, rather than the picker silently looking empty.
 * Used by both the agent and the workflow inspectors.
 */
export function BuilderOptionSelect({
  id,
  source,
  value,
  savedLabel,
  filterValue,
  placeholder,
  describedBy,
  onChange,
}: {
  id?: string;
  source: OptionSource;
  value: string;
  /** Label stored with the value, shown if the option has since disappeared. */
  savedLabel?: string;
  /** Narrow to options whose `group` equals this (models of a provider). */
  filterValue?: string;
  placeholder?: string;
  describedBy?: string;
  onChange: (value: string, label: string) => void;
}) {
  const { options, isLoading } = useAgentBuilderOptions();
  let list: BuilderOption[] = options[source] ?? [];
  if (filterValue) {
    const narrowed = list.filter((option) => option.group === filterValue);
    if (narrowed.length > 0) list = narrowed;
  }
  const missing = value && !list.some((option) => option.value === value);
  const groups = [...new Set(list.map((option) => option.group ?? ''))];

  if (!isLoading && list.length === 0 && !value) {
    return <p className="text-[11px] text-muted-foreground">{EMPTY_SOURCE_TEXT[source]}</p>;
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next, list.find((option) => option.value === next)?.label ?? next)}
    >
      <SelectTrigger id={id} aria-describedby={describedBy} className="w-full">
        <SelectValue placeholder={isLoading ? 'Loading…' : (placeholder ?? 'Choose…')} />
      </SelectTrigger>
      <SelectContent>
        {missing ? <SelectItem value={value}>{savedLabel || value} (no longer available)</SelectItem> : null}
        {groups.map((group) =>
          list
            .filter((option) => (option.group ?? '') === group)
            .map((option, index) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex flex-col">
                  <span>
                    {index === 0 && group && groups.length > 1 ? (
                      <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">{group} ·</span>
                    ) : null}
                    {option.label}
                  </span>
                  {option.hint ? (
                    <span className="line-clamp-1 text-[10px] text-muted-foreground">{option.hint}</span>
                  ) : null}
                </span>
              </SelectItem>
            )),
        )}
      </SelectContent>
    </Select>
  );
}
