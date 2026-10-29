import { describe, expect, it } from 'vitest';
import { routeForDeepLink, workspaceSlugOf } from './deep-links';

describe('routeForDeepLink', () => {
  it('opens a channel by slug', () => {
    expect(routeForDeepLink('c/general')).toEqual({
      pathname: '/channel/[slug]',
      params: { slug: 'general' },
    });
    expect(routeForDeepLink('c/general?msg=%24evt')).toMatchObject({
      params: { slug: 'general' },
    });
  });

  it('opens direct messages by room or by person', () => {
    expect(routeForDeepLink('dms?room=%21abc%3Aexample')).toEqual({
      pathname: '/dm/[roomId]',
      params: { roomId: '!abc:example' },
    });
    expect(routeForDeepLink('/w/acme/dms?user=u_7')).toEqual({
      pathname: '/dm/new',
      params: { user: 'u_7' },
    });
    expect(routeForDeepLink('dms')).toEqual({
      pathname: '/chat',
      params: { tab: 'dms' },
    });
  });

  it('opens an AI run in the execution monitor', () => {
    expect(routeForDeepLink('ai/runs?run=run_42')).toEqual({
      pathname: '/executions',
      params: { run: 'run_42' },
    });
    expect(routeForDeepLink('ai')).toEqual({ pathname: '/agents' });
  });

  it('maps settings, billing and the member directory', () => {
    expect(routeForDeepLink('settings/billing')).toEqual({
      pathname: '/billing',
    });
    expect(routeForDeepLink('directory')).toEqual({ pathname: '/team' });
    expect(routeForDeepLink('automations/builder/wf_9')).toEqual({
      pathname: '/automation/[workflowId]',
      params: { workflowId: 'wf_9' },
    });
  });

  it('maps tasks, documents, meetings, timesheet and coworkers', () => {
    expect(routeForDeepLink('tasks?taskId=t1')).toEqual({
      pathname: '/tasks/[taskId]',
      params: { taskId: 't1' },
    });
    expect(routeForDeepLink('tasks')).toEqual({
      pathname: '/tasks',
    });
    expect(routeForDeepLink('documents?docId=doc_1')).toEqual({
      pathname: '/documents/[docId]',
      params: { docId: 'doc_1' },
    });
    expect(routeForDeepLink('docs')).toEqual({
      pathname: '/documents',
    });
    expect(routeForDeepLink('meetings?meetingId=m1')).toEqual({
      pathname: '/meetings/[meetingId]',
      params: { meetingId: 'm1' },
    });
    expect(routeForDeepLink('meetings')).toEqual({
      pathname: '/meetings',
    });
    expect(routeForDeepLink('timesheet')).toEqual({
      pathname: '/timesheet',
    });
    expect(routeForDeepLink('attendance')).toEqual({
      pathname: '/timesheet',
    });
    expect(routeForDeepLink('coworkers?coworkerId=cw_42')).toEqual({
      pathname: '/coworker/[coworkerId]',
      params: { coworkerId: 'cw_42' },
    });
  });

  it('strips the workspace prefix from absolute and scheme links', () => {
    expect(
      routeForDeepLink('https://app.onetab.ai/w/acme/c/launch'),
    ).toMatchObject({
      params: { slug: 'launch' },
    });
    expect(routeForDeepLink('onetab://w/acme/settings/billing')).toEqual({
      pathname: '/billing',
    });
    expect(routeForDeepLink('/w/acme/ai/runs?run=r1')).toMatchObject({
      params: { run: 'r1' },
    });
  });

  it('falls back to the notification list for unhandled routes or empty input', () => {
    expect(routeForDeepLink('calls?callId=c1')).toEqual({
      pathname: '/notifications',
    });
    expect(routeForDeepLink(null)).toEqual({ pathname: '/notifications' });
    expect(routeForDeepLink('')).toEqual({ pathname: '/notifications' });
  });
});

describe('workspaceSlugOf', () => {
  it('reads the slug from absolute or relative workspace links', () => {
    expect(workspaceSlugOf('https://app.onetab.ai/w/acme/c/general')).toBe(
      'acme',
    );
    expect(workspaceSlugOf('onetab://w/my%20team/ai')).toBe('my team');
    expect(workspaceSlugOf('c/general')).toBeNull();
  });
});
