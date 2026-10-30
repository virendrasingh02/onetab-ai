import { agentsApi, automationsApi, coworkersApi, queryKeys } from '@org/api-client';
import type { AIAgentDetail, AICoworkerDetail, AutomationWorkflowDetail } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { Bot, Users, Workflow } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from '../../router.js';
import { useStudioSession } from '../../session-guard.js';
import type { CatalogNodeItem } from './node-library.js';

/**
 * Steps that hand work to something the workspace already has: an AI
 * coworker, another saved agent, or an automation. Each runs as itself — its
 * own model, tools, apps and approvals — so one canvas can orchestrate all of
 * them instead of each living in its own builder.
 */
export type TeamStepType = 'AI_COWORKER' | 'CALL_AGENT' | 'RUN_WORKFLOW';

export const TEAM_STEP_TYPES = new Set<string>(['AI_COWORKER', 'CALL_AGENT', 'RUN_WORKFLOW']);

/** The config key each team step stores its pick under. */
export const TEAM_REF_KEY: Record<TeamStepType, 'coworkerId' | 'agentId' | 'workflowId'> = {
  AI_COWORKER: 'coworkerId',
  CALL_AGENT: 'agentId',
  RUN_WORKFLOW: 'workflowId',
};

export interface TeamMember {
  id: string;
  name: string;
  /** Role for a coworker or agent, the description for an automation. */
  detail: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface WorkspaceTeam {
  coworkers: TeamMember[];
  agents: TeamMember[];
  automations: TeamMember[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

const byName = (a: TeamMember, b: TeamMember) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);

/** The workspace's coworkers, saved agents (never the canvas being edited) and automations. */
export function useWorkspaceTeam(): WorkspaceTeam {
  const { activeWorkspace } = useStudioSession();
  const { agentId: excludeAgentId } = useParams<{ agentId: string }>();
  const ws = activeWorkspace.id;
  const coworkers = useQuery({ queryKey: queryKeys.coworkers.list(ws), queryFn: () => coworkersApi.list(ws), staleTime: 60_000 });
  // Same key and source as the connectors' "Add to agent" picker.
  const agents = useQuery({ queryKey: ['studio-agents', ws], queryFn: () => agentsApi.list(ws), staleTime: 60_000 });
  const automations = useQuery({ queryKey: queryKeys.automations.list(ws), queryFn: () => automationsApi.list(ws), staleTime: 60_000 });

  return useMemo(
    () => ({
      coworkers: ((coworkers.data ?? []) as AICoworkerDetail[])
        .map((c) => ({ id: c.id, name: c.name, detail: c.role, avatarUrl: c.avatarUrl, isActive: c.isActive }))
        .sort(byName),
      agents: ((agents.data ?? []) as AIAgentDetail[])
        .filter((a) => a.type === 'agent' && a.id !== excludeAgentId)
        .map((a) => ({ id: a.id, name: a.name, detail: a.role, avatarUrl: a.avatarUrl, isActive: a.isActive }))
        .sort(byName),
      automations: ((automations.data ?? []) as AutomationWorkflowDetail[])
        .filter((w) => !w.archivedAt)
        .map((w) => ({ id: w.id, name: w.name, detail: w.description ?? '', avatarUrl: null, isActive: w.isActive }))
        .sort(byName),
      loading: coworkers.isLoading || agents.isLoading || automations.isLoading,
      error: coworkers.isError || agents.isError || automations.isError,
      retry: () => {
        void coworkers.refetch();
        void agents.refetch();
        void automations.refetch();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the query objects change every render; their data doesn't
    [coworkers.data, agents.data, automations.data, coworkers.isLoading, agents.isLoading, automations.isLoading, coworkers.isError, agents.isError, automations.isError, excludeAgentId],
  );
}

/** Who a team step points at, from the loaded team (undefined until it loads, or when it's gone). */
export function teamMemberFor(team: WorkspaceTeam, type: string, id: unknown): TeamMember | undefined {
  if (typeof id !== 'string' || !id) return undefined;
  const list = type === 'AI_COWORKER' ? team.coworkers : type === 'CALL_AGENT' ? team.agents : type === 'RUN_WORKFLOW' ? team.automations : [];
  return list.find((m) => m.id === id);
}

/** One ready-to-place card per coworker, agent and automation. */
export function teamCatalogNodes(team: Pick<WorkspaceTeam, 'coworkers' | 'agents' | 'automations'>): CatalogNodeItem[] {
  return [
    ...team.coworkers.map<CatalogNodeItem>((m) => ({
      key: `coworker:${m.id}`,
      type: 'AI_COWORKER',
      category: 'team',
      label: m.name,
      subtitle: m.isActive ? `Coworker · ${m.detail}` : `Coworker · ${m.detail} · paused`,
      description: `${m.detail ? `${m.detail} — w` : 'W'}orks the step with its own apps, specialists and approvals.`,
      icon: Users,
      badge: 'Coworker',
      defaultConfig: { coworkerId: m.id },
    })),
    ...team.agents.map<CatalogNodeItem>((m) => ({
      key: `agent:${m.id}`,
      type: 'CALL_AGENT',
      category: 'team',
      label: m.name,
      subtitle: m.detail ? `Agent · ${m.detail}` : 'Agent',
      description: `${m.detail ? `${m.detail} — a` : 'A'}nswers with its own model and tools, and passes the answer on.`,
      icon: Bot,
      badge: 'Agent',
      defaultConfig: { agentId: m.id },
    })),
    ...team.automations.map<CatalogNodeItem>((m) => ({
      key: `automation:${m.id}`,
      type: 'RUN_WORKFLOW',
      category: 'team',
      label: m.name,
      subtitle: m.isActive ? 'Automation' : 'Automation · off',
      description: m.detail || `Runs ${m.name} and passes its result on.`,
      icon: Workflow,
      badge: 'Automation',
      defaultConfig: { workflowId: m.id },
    })),
  ];
}

export function useTeamCatalogNodes(): CatalogNodeItem[] {
  const team = useWorkspaceTeam();
  return useMemo(() => teamCatalogNodes(team), [team]);
}
