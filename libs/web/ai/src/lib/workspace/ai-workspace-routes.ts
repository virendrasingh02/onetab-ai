import {
  Activity,
  BookOpen,
  Bot,
  LayoutGrid,
  Library,
  ShieldCheck,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * The AI Workspace — the one place agents, coworkers and workflows are built,
 * run and reviewed. Every former entry point (AI Studio, the standalone Agent
 * Studio, Agents & Apps' builder, Automations, Coworkers) redirects here.
 */
export type AIWorkspaceSection =
  | 'overview'
  | 'agents'
  | 'workflows'
  | 'runs'
  | 'approvals'
  | 'knowledge'
  | 'tools'
  | 'prompts';

export interface AIWorkspaceSectionConfig {
  id: AIWorkspaceSection;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const AI_WORKSPACE_SECTIONS: readonly AIWorkspaceSectionConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, description: 'What is running and what needs you' },
  { id: 'agents', label: 'Agents', icon: Bot, description: 'Agents and AI coworkers' },
  { id: 'workflows', label: 'Workflows', icon: Workflow, description: 'Multi-step automations' },
  { id: 'runs', label: 'Runs', icon: Activity, description: 'Every agent and workflow run' },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck, description: 'Actions waiting for a person' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, description: 'Documents agents can cite' },
  { id: 'tools', label: 'Tools', icon: Wrench, description: 'Built-in tools, MCP servers, secrets' },
  { id: 'prompts', label: 'Prompts', icon: Library, description: 'Reusable prompt templates' },
];

/** `/w/:slug/ai`, or a section / item beneath it. */
export function aiWorkspacePath(slug: string | undefined, ...segments: string[]): string {
  const base = `/w/${slug ?? ''}/ai`;
  const rest = segments.filter(Boolean).join('/');
  return rest ? `${base}/${rest}` : base;
}

/** Which section a pathname is in — the first segment after `/ai`. */
export function sectionFromPath(pathname: string): AIWorkspaceSection {
  const match = /\/ai(?:\/([^/?#]+))?/.exec(pathname);
  const segment = match?.[1];
  return (AI_WORKSPACE_SECTIONS.find((s) => s.id === segment)?.id ?? 'overview') as AIWorkspaceSection;
}
