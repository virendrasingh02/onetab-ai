import { describe, expect, it } from 'vitest';
import {
  APP_NAME,
  formatChannelName,
  formatDocumentTitle,
  resolvePageTitle,
} from './page-title';

describe('formatChannelName', () => {
  it('prefixes public channels with a single #', () => {
    expect(formatChannelName('engineering')).toBe('#engineering');
  });

  it('never doubles an existing # on the stored name', () => {
    expect(formatChannelName('#general')).toBe('#general');
    expect(formatChannelName('# product')).toBe('#product');
  });

  it('omits the # for private channels', () => {
    expect(formatChannelName('leads', { isPrivate: true })).toBe('leads');
  });
});

describe('formatDocumentTitle', () => {
  it('appends the product name', () => {
    expect(formatDocumentTitle('Home')).toBe(`Home — ${APP_NAME}`);
  });

  it('falls back to the bare product name for an empty context', () => {
    expect(formatDocumentTitle('')).toBe(APP_NAME);
    expect(formatDocumentTitle(null)).toBe(APP_NAME);
    expect(formatDocumentTitle(undefined)).toBe(APP_NAME);
    expect(formatDocumentTitle(APP_NAME)).toBe(APP_NAME);
  });
});

describe('resolvePageTitle — static routes', () => {
  it('resolves the workspace root to Home', () => {
    expect(resolvePageTitle('/w/acme').title).toBe('Home');
    expect(resolvePageTitle('/w/acme/').title).toBe('Home');
    expect(resolvePageTitle('/w/acme/home').title).toBe('Home');
  });

  it.each([
    ['/w/acme/files', 'Files'],
    ['/w/acme/inbox', 'Inbox'],
    ['/w/acme/threads', 'Threads'],
    ['/w/acme/directory', 'Team Directory'],
    ['/w/acme/members', 'Team Directory'],
    ['/w/acme/dashboard', 'Dashboard'],
    ['/w/acme/meetings', 'Meetings'],
    ['/w/acme/whiteboards', 'Whiteboards'],
    ['/w/acme/integrations', 'Integration Hub'],
    ['/w/acme/apps', 'Apps'],
    ['/w/acme/automations/builder', 'Automations & Workflows'],
  ])('resolves %s to %s', (path, title) => {
    expect(resolvePageTitle(path).title).toBe(title);
  });

  it('shares one title across task/project alias routes', () => {
    for (const path of ['/w/acme/tasks', '/w/acme/kanban', '/w/acme/projects']) {
      expect(resolvePageTitle(path).title).toBe('Tasks & Projects');
    }
  });

  it('resolves Settings from its own nested surface', () => {
    expect(resolvePageTitle('/w/acme/settings').title).toBe('Settings');
    expect(resolvePageTitle('/w/acme/settings/appearance').title).toBe(
      'Settings',
    );
    expect(resolvePageTitle('/settings').title).toBe('Settings');
  });

  it('resolves routes outside any workspace', () => {
    expect(resolvePageTitle('/').title).toBe('Home');
    expect(resolvePageTitle('/login').title).toBe('Sign in');
    expect(resolvePageTitle('/workspaces/new').title).toBe(
      'Create a workspace',
    );
    expect(resolvePageTitle('/invite/tok_123').title).toBe('Join a workspace');
    expect(resolvePageTitle('/404').title).toBe('Page not found');
  });

  it('returns an empty title for a route with no context of its own', () => {
    expect(resolvePageTitle('/auth/callback').title).toBe('');
    expect(formatDocumentTitle(resolvePageTitle('/auth/callback').title)).toBe(
      APP_NAME,
    );
  });
});

describe('resolvePageTitle — dynamic routes', () => {
  it('uses the channel name with a # for public channels', () => {
    const resolved = resolvePageTitle('/w/acme/c/engineering', {
      channel: { name: 'engineering' },
    });
    expect(resolved).toEqual({ title: '#engineering', isPending: false });
  });

  it('drops the # for a private channel', () => {
    expect(
      resolvePageTitle('/w/acme/c/leads', {
        channel: { name: 'leads', isPrivate: true },
      }).title,
    ).toBe('leads');
  });

  it('falls back to a safe placeholder while the channel is unresolved', () => {
    expect(resolvePageTitle('/w/acme/c/engineering')).toEqual({
      title: 'Channel',
      isPending: true,
    });
  });

  it('resolves a DM to the peer display name', () => {
    expect(
      resolvePageTitle('/w/acme/dms/user_42', { dmPeerName: 'Virendra Singh' })
        .title,
    ).toBe('Virendra Singh');
    expect(resolvePageTitle('/w/acme/dms/user_42').title).toBe(
      'Direct message',
    );
  });

  it('resolves a project from either alias', () => {
    for (const path of [
      '/w/acme/projects/p_1',
      '/w/acme/tasks/p_1',
    ]) {
      expect(
        resolvePageTitle(path, { projectName: 'Project Alpha' }).title,
      ).toBe('Project Alpha');
    }
    expect(resolvePageTitle('/w/acme/projects/p_1').title).toBe('Project');
  });

  it('resolves an agent chat', () => {
    expect(
      resolvePageTitle('/w/acme/agents/a_1/chat', { agentName: 'Researcher' })
        .title,
    ).toBe('Researcher');
    expect(resolvePageTitle('/w/acme/agents/a_1/chat').title).toBe('AI Agent');
  });

  it('resolves an app chat', () => {
    expect(
      resolvePageTitle('/w/acme/apps/github/chat', { appName: 'GitHub' }).title,
    ).toBe('GitHub');
    expect(resolvePageTitle('/w/acme/apps/github/chat').title).toBe('App');
  });

  it('resolves a document from either alias', () => {
    for (const path of ['/w/acme/docs/d_1', '/w/acme/notes/d_1']) {
      expect(
        resolvePageTitle(path, { docTitle: 'Q3 Planning' }).title,
      ).toBe('Q3 Planning');
    }
    expect(resolvePageTitle('/w/acme/docs/d_1').title).toBe('Document');
  });

  it('does not confuse a static sibling with a dynamic route', () => {
    expect(resolvePageTitle('/w/acme/channels').title).toBe('Channels');
    expect(resolvePageTitle('/w/acme/channels/new').title).toBe(
      'Create a channel',
    );
    expect(resolvePageTitle('/w/acme/agents/chat').title).toBe('AI Agents');
    expect(resolvePageTitle('/w/acme/agents/builder').title).toBe(
      'Agent Builder',
    );
  });

  it('falls back to the workspace name for an unknown sub-route', () => {
    expect(
      resolvePageTitle('/w/acme/some/future/screen', {
        workspaceName: 'Acme Inc',
      }).title,
    ).toBe('Acme Inc');
  });
});
