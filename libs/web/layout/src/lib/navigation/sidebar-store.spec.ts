// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSidebarStore,
  DEFAULT_ACTIVITY_INDICATORS,
  DEFAULT_SIDEBAR_SECTIONS,
  toSidebarActivityConfig,
  type SidebarSectionId,
} from './sidebar-store.js';
import {
  createSectionId,
  type SidebarSectionDef,
} from './sidebar-sections.js';

function manualSection(label: string): SidebarSectionDef {
  return {
    id: createSectionId(),
    label,
    kind: 'manual',
    order: 0,
    collapsed: false,
    hideWhenEmpty: false,
    channelIds: [],
  };
}

describe('Sidebar Store - Section Reordering & Customization', () => {
  beforeEach(() => {
    useSidebarStore.getState().resetAllPreferences();
  });

  it('initializes with default sidebar sections', () => {
    const state = useSidebarStore.getState();
    expect(Object.keys(state.sections)).toHaveLength(DEFAULT_SIDEBAR_SECTIONS.length);
    expect(state.sections.channels.visible).toBe(true);
    expect(state.sections.dms.visible).toBe(true);
    expect(state.sections.projects.visible).toBe(true);
    expect(state.sections.docs.visible).toBe(true);
    expect(state.sections.agents.visible).toBe(true);
    expect(state.sections.apps.visible).toBe(true);
    expect(state.sections.workflows.visible).toBe(true);
    expect(state.sections.starred.visible).toBe(true);
  });

  it('toggles section visibility', () => {
    const { setSectionVisibility } = useSidebarStore.getState();

    setSectionVisibility('projects', false);
    expect(useSidebarStore.getState().sections.projects.visible).toBe(false);

    setSectionVisibility('projects', true);
    expect(useSidebarStore.getState().sections.projects.visible).toBe(true);
  });

  it('reorders sidebar sections with custom ordering', () => {
    const { reorderSections } = useSidebarStore.getState();
    const customOrder: SidebarSectionId[] = [
      'projects',
      'docs',
      'agents',
      'channels',
      'dms',
      'apps',
      'workflows',
      'starred',
    ];

    reorderSections(customOrder);

    const updatedSections = useSidebarStore.getState().sections;
    expect(updatedSections.projects.order).toBe(0);
    expect(updatedSections.docs.order).toBe(1);
    expect(updatedSections.agents.order).toBe(2);
    expect(updatedSections.channels.order).toBe(3);
    expect(updatedSections.dms.order).toBe(4);
  });

  it('moves a section from one position to another', () => {
    const { moveSection } = useSidebarStore.getState();

    // Move 'agents' before 'channels'
    moveSection('agents', 'channels');

    const updatedSections = useSidebarStore.getState().sections;
    expect(updatedSections.agents.order).toBeLessThan(updatedSections.channels.order);
  });

  it('resets section preferences to defaults', () => {
    const { reorderSections, setSectionVisibility, resetSections } =
      useSidebarStore.getState();

    setSectionVisibility('channels', false);
    reorderSections(['workflows', 'apps', 'agents', 'docs', 'projects', 'dms', 'channels', 'starred']);

    resetSections();

    const state = useSidebarStore.getState();
    expect(state.sections.channels.visible).toBe(true);
    expect(state.sections.channels.order).toBe(1);
  });

  it('reorders and moves specific channels (e.g. general below other channels)', () => {
    const { moveChannel, reorderChannels } = useSidebarStore.getState();
    const wsId = 'workspace-1';
    const initialChannels = ['chan-general', 'chan-random', 'chan-dev', 'chan-marketing'];

    // Move #general after #dev
    moveChannel(wsId, 'chan-general', 'chan-dev', initialChannels);

    let updatedOrder = useSidebarStore.getState().channelOrders[wsId];
    expect(updatedOrder).toEqual(['chan-random', 'chan-dev', 'chan-general', 'chan-marketing']);

    // Directly reorder
    reorderChannels(wsId, ['chan-dev', 'chan-marketing', 'chan-random', 'chan-general']);
    updatedOrder = useSidebarStore.getState().channelOrders[wsId];
    expect(updatedOrder[0]).toBe('chan-dev');
    expect(updatedOrder[3]).toBe('chan-general');
  });

  it('reorders resource items inside DMs, Projects, Agents, Apps, Workflows, and Starred', () => {
    const { moveResourceItem, reorderResourceItems } = useSidebarStore.getState();
    const wsId = 'workspace-1';

    // 1. Direct Messages
    const initialDms = ['user-alice', 'user-bob', 'user-charlie'];
    moveResourceItem(wsId, 'dms', 'user-alice', 'user-bob', initialDms);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.dms).toEqual([
      'user-bob',
      'user-alice',
      'user-charlie',
    ]);

    // 2. Projects
    const initialProjects = ['proj-alpha', 'proj-beta', 'proj-gamma'];
    moveResourceItem(wsId, 'projects', 'proj-gamma', 'proj-alpha', initialProjects);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.projects).toEqual([
      'proj-gamma',
      'proj-alpha',
      'proj-beta',
    ]);

    // 3. AI Agents
    const initialAgents = ['agent-researcher', 'agent-coder', 'agent-designer'];
    moveResourceItem(wsId, 'agents', 'agent-designer', 'agent-researcher', initialAgents);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.agents).toEqual([
      'agent-designer',
      'agent-researcher',
      'agent-coder',
    ]);

    // 4. Apps & Integrations
    const initialApps = ['github', 'jira', 'slack', 'notion'];
    moveResourceItem(wsId, 'apps', 'notion', 'github', initialApps);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.apps).toEqual([
      'notion',
      'github',
      'jira',
      'slack',
    ]);

    // 5. Workflows
    const initialWorkflows = ['wf-deploy', 'wf-alert', 'wf-backup'];
    moveResourceItem(wsId, 'workflows', 'wf-backup', 'wf-deploy', initialWorkflows);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.workflows).toEqual([
      'wf-backup',
      'wf-deploy',
      'wf-alert',
    ]);
    reorderResourceItems(wsId, 'workflows', ['wf-alert', 'wf-backup', 'wf-deploy']);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.workflows).toEqual([
      'wf-alert',
      'wf-backup',
      'wf-deploy',
    ]);

    // 6. Starred items
    const initialStarred = ['channel-1', 'doc-2', 'proj-3'];
    moveResourceItem(wsId, 'starred', 'proj-3', 'channel-1', initialStarred);
    expect(useSidebarStore.getState().resourceOrders[wsId]?.starred).toEqual([
      'proj-3',
      'channel-1',
      'doc-2',
    ]);
  });
});

describe('Sidebar Store - Activity Indicator Preferences', () => {
  beforeEach(() => {
    useSidebarStore.getState().resetAllPreferences();
  });

  it('starts from the defaults', () => {
    expect(useSidebarStore.getState().activityIndicators).toEqual(
      DEFAULT_ACTIVITY_INDICATORS,
    );
  });

  it('updates a single preference without touching the others', () => {
    const { setActivityIndicator } = useSidebarStore.getState();

    setActivityIndicator('enabled', false);
    setActivityIndicator('style', 'dot');

    const prefs = useSidebarStore.getState().activityIndicators;
    expect(prefs.enabled).toBe(false);
    expect(prefs.style).toBe('dot');
    expect(prefs.showForChannelsAndDms).toBe(true);
  });

  it('resets indicators on their own and via resetAllPreferences', () => {
    const { setActivityIndicator, resetActivityIndicators } =
      useSidebarStore.getState();

    setActivityIndicator('showCounts', false);
    resetActivityIndicators();
    expect(useSidebarStore.getState().activityIndicators).toEqual(
      DEFAULT_ACTIVITY_INDICATORS,
    );

    setActivityIndicator('showForNotifications', false);
    useSidebarStore.getState().resetAllPreferences();
    expect(useSidebarStore.getState().activityIndicators).toEqual(
      DEFAULT_ACTIVITY_INDICATORS,
    );
  });

  it('persists activity indicators through the zustand persist layer', () => {
    useSidebarStore.getState().setActivityIndicator('style', 'badge');
    const raw = localStorage.getItem('onetab:sidebar_preferences');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).state.activityIndicators.style).toBe(
      'badge',
    );
  });

  it('maps preferences to the @org/ui indicator config', () => {
    const cfg = toSidebarActivityConfig({
      ...DEFAULT_ACTIVITY_INDICATORS,
      showForChannelsAndDms: false,
      showForNotifications: false,
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.surfaces.channels).toBe(false);
    expect(cfg.surfaces.dms).toBe(false);
    expect(cfg.surfaces.notifications).toBe(false);
    expect(cfg.surfaces.main).toBe(true);
    expect(cfg.surfaces.workspace).toBe(true);
  });
});

describe('Sidebar Store - Smart sections & channel sorting (§1.1 / §1.2)', () => {
  const A = 'workspace-a';
  const B = 'workspace-b';

  beforeEach(() => {
    useSidebarStore.getState().resetAllPreferences();
  });

  it('stores a channel sort per workspace with a sensible default direction', () => {
    const { setChannelSort } = useSidebarStore.getState();

    setChannelSort(A, 'recentActivity');
    setChannelSort(B, 'alphabetical');

    const state = useSidebarStore.getState();
    expect(state.channelSort[A]).toEqual({
      mode: 'recentActivity',
      direction: 'desc',
    });
    expect(state.channelSort[B]).toEqual({
      mode: 'alphabetical',
      direction: 'asc',
    });
  });

  it('keeps section definitions isolated per workspace', () => {
    const { addSectionDef } = useSidebarStore.getState();
    addSectionDef(A, manualSection('Squad A'));

    expect(useSidebarStore.getState().sectionDefs[A]).toHaveLength(1);
    expect(useSidebarStore.getState().sectionDefs[B]).toBeUndefined();
  });

  it('reindexes order on add and remove', () => {
    const { addSectionDef, removeSectionDef } = useSidebarStore.getState();
    addSectionDef(A, manualSection('one'));
    addSectionDef(A, manualSection('two'));
    addSectionDef(A, manualSection('three'));

    let defs = useSidebarStore.getState().sectionDefs[A];
    expect(defs.map((d) => d.order)).toEqual([0, 1, 2]);

    removeSectionDef(A, defs[1].id);
    defs = useSidebarStore.getState().sectionDefs[A];
    expect(defs.map((d) => d.label)).toEqual(['one', 'three']);
    expect(defs.map((d) => d.order)).toEqual([0, 1]);
  });

  it('moves a channel between manual sections, never duplicating it', () => {
    const { addSectionDef, assignChannelToSection } =
      useSidebarStore.getState();
    addSectionDef(A, manualSection('first'));
    addSectionDef(A, manualSection('second'));
    const [first, second] = useSidebarStore.getState().sectionDefs[A];

    assignChannelToSection(A, first.id, 'chan-1');
    expect(
      useSidebarStore.getState().sectionDefs[A][0].channelIds,
    ).toEqual(['chan-1']);

    assignChannelToSection(A, second.id, 'chan-1');
    const defs = useSidebarStore.getState().sectionDefs[A];
    expect(defs[0].channelIds).toEqual([]);
    expect(defs[1].channelIds).toEqual(['chan-1']);
  });

  it('clears channel priority when set back to none', () => {
    const { setChannelPriority } = useSidebarStore.getState();
    setChannelPriority(A, 'chan-1', 3);
    expect(useSidebarStore.getState().channelMeta[A]['chan-1'].priority).toBe(3);

    setChannelPriority(A, 'chan-1', 0);
    expect(useSidebarStore.getState().channelMeta[A]['chan-1']).toBeUndefined();
  });

  it('tallies channel visits and prunes the least recent past the cap', () => {
    const { recordChannelVisit } = useSidebarStore.getState();

    recordChannelVisit(A, 'chan-1');
    recordChannelVisit(A, 'chan-1');
    recordChannelVisit(A, 'chan-2');
    expect(useSidebarStore.getState().channelVisits[A]['chan-1'].count).toBe(2);
    expect(useSidebarStore.getState().channelVisits[A]['chan-2'].count).toBe(1);

    for (let i = 0; i < 200; i++) recordChannelVisit(A, `bulk-${i}`);
    const kept = Object.keys(useSidebarStore.getState().channelVisits[A]);
    expect(kept.length).toBeLessThanOrEqual(120);
  });

  it('resetChannelOrganization only clears the named workspace', () => {
    const { setChannelSort, addSectionDef, resetChannelOrganization } =
      useSidebarStore.getState();
    setChannelSort(A, 'unreadCount');
    setChannelSort(B, 'mentions');
    addSectionDef(A, manualSection('gone'));
    addSectionDef(B, manualSection('stays'));

    resetChannelOrganization(A);

    const state = useSidebarStore.getState();
    expect(state.channelSort[A]).toBeUndefined();
    expect(state.sectionDefs[A]).toBeUndefined();
    expect(state.channelSort[B]).toEqual({ mode: 'mentions', direction: 'desc' });
    expect(state.sectionDefs[B]).toHaveLength(1);
  });

  it('persists the new keys through the zustand persist layer', () => {
    useSidebarStore.getState().setChannelSort(A, 'priority');
    const raw = localStorage.getItem('onetab:sidebar_preferences');
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.channelSort[A]).toEqual({
      mode: 'priority',
      direction: 'desc',
    });
    expect(parsed.state).toHaveProperty('sectionDefs');
    expect(parsed.state).toHaveProperty('channelMeta');
    expect(parsed.state).toHaveProperty('channelVisits');
  });
});

