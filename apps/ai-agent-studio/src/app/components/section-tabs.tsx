import {
  PageBar,
  PageTabBar,
  ResponsiveTabs,
  Tabs,
  TabsTrigger,
} from '@org/ui';
import {
  Bot,
  GitBranch,
  ListChecks,
  Server,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useLocation, useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

interface SectionPage {
  segment: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Pages that share one sidebar entry. Each keeps its own route, and shows
 * these tabs under its header so you can move between them.
 */
export const STUDIO_SECTIONS = {
  // Agents, coworkers and workflows are all built on the same canvas.
  agents: [
    { segment: 'agents', label: 'Agents', icon: Bot },
    { segment: 'coworkers', label: 'AI Coworkers', icon: Users },
    { segment: 'workflows', label: 'Workflows', icon: GitBranch },
    { segment: 'planned', label: 'Planned', icon: ListChecks },
  ],
  tools: [
    { segment: 'tools', label: 'All tools', icon: Wrench },
    { segment: 'tool-access', label: 'Access rules', icon: ShieldCheck },
    { segment: 'mcp', label: 'MCP servers', icon: Server },
  ],
} satisfies Record<string, SectionPage[]>;

export type StudioSection = keyof typeof STUDIO_SECTIONS;

/** The title a section's pages share — the same name as its sidebar entry. */
const SECTION_TITLES: Record<
  StudioSection,
  { title: string; icon: ComponentType<{ className?: string }> }
> = {
  agents: { title: 'Agents & Workflows', icon: Bot },
  tools: { title: 'Tools', icon: Wrench },
};

/** Full `/w/:slug/ai/<segment>` paths of a section's pages. */
export function studioSectionPaths(
  slug: string,
  section: StudioSection,
): string[] {
  return STUDIO_SECTIONS[section].map((t) => `/w/${slug}/ai/${t.segment}`);
}

/** The section's tabs as full paths, plus the one the current route is on. */
function useSectionTabs(section: StudioSection) {
  const { activeWorkspace } = useStudioSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = STUDIO_SECTIONS[section].map((t) => ({
    ...t,
    value: `/w/${activeWorkspace.slug}/ai/${t.segment}`,
  }));
  const active = items.find(
    (i) => pathname === i.value || pathname.startsWith(i.value + '/'),
  );
  return { items, value: active?.value ?? items[0].value, navigate };
}

/** Tabs for a `PageHeader` toolbar. */
export function SectionTabs({ section }: { section: StudioSection }) {
  const { items, value, navigate } = useSectionTabs(section);

  return (
    <ResponsiveTabs
      aria-label="Section pages"
      variant="underline"
      size="sm"
      value={value}
      onValueChange={(to) => navigate(to)}
      items={items.map(({ value, label }) => ({ value, label }))}
    />
  );
}

/**
 * Tab row that sits directly under a `PageBar hasTabs`. `counts` (keyed by
 * segment) shows a count on the tabs whose page already knows it.
 */
export function SectionTabBar({
  section,
  counts,
}: {
  section: StudioSection;
  counts?: Partial<Record<string, number>>;
}) {
  const { items, value, navigate } = useSectionTabs(section);

  return (
    <Tabs value={value} onValueChange={(to) => navigate(to)}>
      <PageTabBar>
        {items.map(({ value, label, segment, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            icon={<Icon className="size-4" aria-hidden />}
            count={counts?.[segment]}
          >
            {label}
          </TabsTrigger>
        ))}
      </PageTabBar>
    </Tabs>
  );
}

/**
 * The header every page of a section opens with: the section's own title (so
 * it doesn't change, or repeat the tab, as you switch pages), the current
 * page's actions on the right, and the page tabs — all one sticky block.
 */
export function SectionHeader({
  section,
  actions,
  counts,
}: {
  section: StudioSection;
  actions?: ReactNode;
  counts?: Partial<Record<string, number>>;
}) {
  const { title, icon: Icon } = SECTION_TITLES[section];
  return (
    <PageBar icon={<Icon />} title={title} actions={actions} hasTabs>
      <SectionTabBar section={section} counts={counts} />
    </PageBar>
  );
}
