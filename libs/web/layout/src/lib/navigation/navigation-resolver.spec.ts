// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveNavigation } from './navigation-resolver.js';
import { isRouteActive } from './route-matcher.js';
import { DEFAULT_NAV_ITEMS } from './navigation.config.js';

describe('Navigation Resolver', () => {
  it('resolves default navigation when no user preferences exist', () => {
    const { allItems, visibleItems, groups } = resolveNavigation(undefined, {
      workspaceSlug: 'test-workspace',
    });

    expect(allItems.length).toBe(DEFAULT_NAV_ITEMS.length);
    expect(visibleItems.length).toBe(DEFAULT_NAV_ITEMS.filter((i) => i.visible).length);
    expect(groups.length).toBeGreaterThan(0);

    // Verify Home has full path
    const home = allItems.find((i) => i.id === 'home');
    expect(home).toBeDefined();
    expect(home?.fullPath).toBe('/w/test-workspace');

    // Verify Tasks full path
    const tasks = allItems.find((i) => i.id === 'tasks');
    expect(tasks?.fullPath).toBe('/w/test-workspace/tasks');
  });

  it('safely incorporates user preferences (hiding items & reordering)', () => {
    const userPrefs = {
      schedule: { visible: false, order: 0 },
      tasks: { visible: true, order: 1 },
      home: { visible: true, order: 2 },
    };

    const { allItems, visibleItems } = resolveNavigation(userPrefs, {
      workspaceSlug: 'test-workspace',
    });

    const schedule = allItems.find((i) => i.id === 'schedule');
    expect(schedule?.isVisible).toBe(false);

    // Visible items should not include hidden schedule
    expect(visibleItems.some((i) => i.id === 'schedule')).toBe(false);
  });

  it('safely incorporates new platform navigation items without resetting user preferences', () => {
    // User only customized "home" and "inbox"
    const userPrefs = {
      home: { visible: true, order: 1 },
      inbox: { visible: true, order: 0 },
    };

    const { allItems } = resolveNavigation(userPrefs, {
      workspaceSlug: 'test-workspace',
    });

    // New items like "agents", "automations", "whiteboards" should automatically appear with their defaults
    const agents = allItems.find((i) => i.id === 'agents');
    expect(agents).toBeDefined();
    expect(agents?.isVisible).toBe(true);
  });

  it('injects dynamic unread badges for inbox', () => {
    const { allItems } = resolveNavigation(undefined, {
      workspaceSlug: 'test-workspace',
      inboxUnread: 5,
    });

    const inbox = allItems.find((i) => i.id === 'inbox');
    expect(inbox?.badge).toBe(5);
  });
});

describe('Route Matcher', () => {
  it('matches exact home route', () => {
    expect(isRouteActive('', '/w/acme', 'acme')).toBe(true);
    expect(isRouteActive('', '/w/acme/home', 'acme')).toBe(true);
    expect(isRouteActive('home', '/w/acme', 'acme')).toBe(true);
    expect(isRouteActive('home', '/w/acme/tasks', 'acme')).toBe(false);
  });

  it('matches task and project route aliases and subroutes', () => {
    expect(isRouteActive('tasks', '/w/acme/tasks', 'acme')).toBe(true);
    expect(isRouteActive('tasks', '/w/acme/kanban', 'acme')).toBe(true);
    expect(isRouteActive('tasks', '/w/acme/projects', 'acme')).toBe(true);
    expect(isRouteActive('tasks', '/w/acme/tasks/subtask-1', 'acme')).toBe(true);
  });

  it('matches docs and subroutes', () => {
    expect(isRouteActive('docs', '/w/acme/docs', 'acme')).toBe(true);
    expect(isRouteActive('docs', '/w/acme/notes', 'acme')).toBe(true);
  });

  it('matches agents and automations', () => {
    expect(isRouteActive('agents', '/w/acme/agents', 'acme')).toBe(true);
    expect(isRouteActive('agents', '/w/acme/agents/bot-1/chat', 'acme')).toBe(true);
    expect(isRouteActive('automations', '/w/acme/automations/builder', 'acme')).toBe(true);
  });
});
