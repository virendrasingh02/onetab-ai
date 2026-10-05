import { describe, it, expect } from 'vitest';
import { ChannelRole, WorkspaceRole } from './enums.js';
import {
  evaluateMention,
  canManageChannelMembers,
  toPlatformUserId,
  type ComposerReachability,
  type DetectedMention,
} from './composer-policy.js';

const reachableAll: ComposerReachability = {
  userIds: new Set(['@alice:matrix.org', '@bob:matrix.org']),
  agentIds: new Set(['agent-1']),
  coworkerIds: new Set(['coworker-1']),
  appIds: new Set(['app-1']),
};

const reachableEmpty: ComposerReachability = {
  userIds: new Set(),
  agentIds: new Set(),
  coworkerIds: new Set(),
  appIds: new Set(),
};

describe('canManageChannelMembers', () => {
  it('returns true for channel ADMIN', () => {
    expect(
      canManageChannelMembers({
        channelRole: ChannelRole.ADMIN,
        workspaceRole: WorkspaceRole.MEMBER,
      }),
    ).toBe(true);
  });

  it('returns true for workspace ADMIN / OWNER even if channel MEMBER', () => {
    expect(
      canManageChannelMembers({
        channelRole: ChannelRole.MEMBER,
        workspaceRole: WorkspaceRole.ADMIN,
      }),
    ).toBe(true);
    expect(
      canManageChannelMembers({
        channelRole: ChannelRole.MEMBER,
        workspaceRole: WorkspaceRole.OWNER,
      }),
    ).toBe(true);
  });

  it('returns false for plain MEMBER in both channel and workspace', () => {
    expect(
      canManageChannelMembers({
        channelRole: ChannelRole.MEMBER,
        workspaceRole: WorkspaceRole.MEMBER,
      }),
    ).toBe(false);
  });

  it('returns false for GUEST or null roles', () => {
    expect(
      canManageChannelMembers({
        channelRole: null,
        workspaceRole: WorkspaceRole.GUEST,
      }),
    ).toBe(false);
  });
});

describe('evaluateMention — group broadcast mentions', () => {
  it('always resolves group mentions as reachable with no action', () => {
    const mention: DetectedMention = { id: 'channel', kind: 'group' };
    const res = evaluateMention(mention, {
      surfaceKind: 'channel',
      reachable: reachableEmpty,
      viewerCanManage: false,
    });
    expect(res).toEqual({ reachable: true, addAction: 'none' });
  });
});

describe('evaluateMention — channel surface', () => {
  it('reachable user produces no action', () => {
    const res = evaluateMention(
      { id: '@alice:matrix.org', kind: 'user' },
      { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: true },
    );
    expect(res).toEqual({ reachable: true, addAction: 'none' });
  });

  it('unreachable user with viewerCanManage:true offers channel-member add action', () => {
    const res = evaluateMention(
      { id: '@charlie:matrix.org', kind: 'user' },
      { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: true },
    );
    expect(res).toEqual({ reachable: false, addAction: 'channel-member' });
  });

  it('unreachable user with viewerCanManage:false offers addAction:none', () => {
    const res = evaluateMention(
      { id: '@charlie:matrix.org', kind: 'user' },
      { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: false },
    );
    expect(res).toEqual({ reachable: false, addAction: 'none' });
  });

  it('unreachable agent offers channel-agent if can manage, none if cannot', () => {
    expect(
      evaluateMention(
        { id: 'agent-2', kind: 'agent' },
        { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: true },
      ),
    ).toEqual({ reachable: false, addAction: 'channel-agent' });

    expect(
      evaluateMention(
        { id: 'agent-2', kind: 'agent' },
        { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: false },
      ),
    ).toEqual({ reachable: false, addAction: 'none' });
  });

  it('unreachable coworker offers channel-agent if can manage, none if cannot', () => {
    expect(
      evaluateMention(
        { id: 'coworker-2', kind: 'coworker' },
        { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: true },
      ),
    ).toEqual({ reachable: false, addAction: 'channel-agent' });
  });

  it('unreachable app offers channel-app if can manage, none if cannot', () => {
    expect(
      evaluateMention(
        { id: 'app-2', kind: 'app' },
        { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: true },
      ),
    ).toEqual({ reachable: false, addAction: 'channel-app' });

    expect(
      evaluateMention(
        { id: 'app-2', kind: 'app' },
        { surfaceKind: 'channel', reachable: reachableAll, viewerCanManage: false },
      ),
    ).toEqual({ reachable: false, addAction: 'none' });
  });
});

describe('evaluateMention — group-dm surface', () => {
  it('unreachable user offers group-dm-member action', () => {
    const res = evaluateMention(
      { id: '@charlie:matrix.org', kind: 'user' },
      { surfaceKind: 'group-dm', reachable: reachableAll, viewerCanManage: false },
    );
    expect(res).toEqual({ reachable: false, addAction: 'group-dm-member' });
  });

  it('reachable user in group-dm is reachable:true', () => {
    const res = evaluateMention(
      { id: '@alice:matrix.org', kind: 'user' },
      { surfaceKind: 'group-dm', reachable: reachableAll, viewerCanManage: false },
    );
    expect(res).toEqual({ reachable: true, addAction: 'none' });
  });
});

describe('evaluateMention — 1:1 dm surface', () => {
  it('unreachable user offers start-group action', () => {
    const res = evaluateMention(
      { id: '@charlie:matrix.org', kind: 'user' },
      { surfaceKind: 'dm', reachable: reachableAll, viewerCanManage: false },
    );
    expect(res).toEqual({ reachable: false, addAction: 'start-group' });
  });
});

describe('evaluateMention — 1:1 agent/coworker/app surface', () => {
  it('third-party mention is unreachable with addAction:none', () => {
    const res = evaluateMention(
      { id: '@charlie:matrix.org', kind: 'user' },
      { surfaceKind: 'agent', reachable: reachableAll, viewerCanManage: false },
    );
    expect(res).toEqual({ reachable: false, addAction: 'none' });
  });
});

describe('toPlatformUserId', () => {
  it('unwraps the bridged Matrix spelling to the platform id', () => {
    expect(toPlatformUserId('@onetab_ckabc123:chat.example.com')).toBe(
      'ckabc123',
    );
    expect(toPlatformUserId('@onetab_ckabc123:localhost:8008')).toBe(
      'ckabc123',
    );
  });

  it('passes every other id through untouched', () => {
    expect(toPlatformUserId('ckabc123')).toBe('ckabc123');
    expect(toPlatformUserId('@alice:matrix.org')).toBe('@alice:matrix.org');
    expect(toPlatformUserId('agent-1')).toBe('agent-1');
  });
});

describe('evaluateMention — mixed id spellings', () => {
  const roster: ComposerReachability = {
    ...reachableEmpty,
    userIds: new Set(['@onetab_ckalice:chat.example.com']),
  };

  it('treats a platform-id mention of a room member as reachable', () => {
    const result = evaluateMention(
      { id: 'ckalice', kind: 'user' },
      { surfaceKind: 'channel', reachable: roster, viewerCanManage: true },
    );
    expect(result).toEqual({ reachable: true, addAction: 'none' });
  });

  it('still flags a platform-id mention of someone outside the room', () => {
    const result = evaluateMention(
      { id: 'ckbob', kind: 'user' },
      { surfaceKind: 'channel', reachable: roster, viewerCanManage: true },
    );
    expect(result).toEqual({ reachable: false, addAction: 'channel-member' });
  });
});
