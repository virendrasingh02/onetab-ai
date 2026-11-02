import { ResponsiveTabs } from '@org/ui';
import { useLocation, useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

/**
 * Pages that share one sidebar entry. Each keeps its own route, and shows
 * these tabs under its header so you can move between them.
 */
export const STUDIO_SECTIONS = {
  agents: [
    { segment: 'my-agents', label: 'Canvas agents' },
    { segment: 'agents', label: 'Planned agents' },
  ],
  tools: [
    { segment: 'tools', label: 'All tools' },
    { segment: 'tool-access', label: 'Access rules' },
    { segment: 'mcp', label: 'MCP servers' },
  ],
} as const;

export type StudioSection = keyof typeof STUDIO_SECTIONS;

/** Full `/w/:slug/ai/<segment>` paths of a section's pages. */
export function studioSectionPaths(slug: string, section: StudioSection): string[] {
  return STUDIO_SECTIONS[section].map((t) => `/w/${slug}/ai/${t.segment}`);
}

export function SectionTabs({ section }: { section: StudioSection }) {
  const { activeWorkspace } = useStudioSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = STUDIO_SECTIONS[section].map((t) => ({
    value: `/w/${activeWorkspace.slug}/ai/${t.segment}`,
    label: t.label,
  }));
  const active = items.find((i) => pathname === i.value || pathname.startsWith(i.value + '/'));

  return (
    <ResponsiveTabs
      aria-label="Section pages"
      variant="underline"
      size="sm"
      value={active?.value ?? items[0].value}
      onValueChange={(to) => navigate(to)}
      items={items}
    />
  );
}
