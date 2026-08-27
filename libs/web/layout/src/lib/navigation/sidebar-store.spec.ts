// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSidebarStore,
  DEFAULT_SIDEBAR_SECTIONS,
  type SidebarSectionId,
} from './sidebar-store.js';

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

