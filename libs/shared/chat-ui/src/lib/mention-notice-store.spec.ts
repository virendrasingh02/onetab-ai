import { beforeEach, describe, expect, it } from 'vitest';
import {
  useMentionNoticeStore,
  type MentionNoticeTarget,
} from './mention-notice-store.js';

const github: MentionNoticeTarget = {
  id: 'int-1',
  name: 'GitHub',
  kind: 'app',
  addAction: 'channel-app',
};
const alice: MentionNoticeTarget = {
  id: 'u-alice',
  name: 'Alice',
  kind: 'user',
  addAction: 'channel-member',
};

const raise = (targets: MentionNoticeTarget[], extra: object = {}) =>
  useMentionNoticeStore.getState().raise({
    conversationKey: '!room:a',
    surfaceKind: 'channel',
    targets,
    ...extra,
  });

describe('useMentionNoticeStore', () => {
  beforeEach(() => {
    useMentionNoticeStore.setState({ notices: [] });
  });

  it('raises an idle notice with nothing added yet', () => {
    const id = raise([github], { anchorId: 'm.1' });
    const [notice] = useMentionNoticeStore.getState().notices;
    expect(notice).toMatchObject({
      id,
      anchorId: 'm.1',
      status: 'idle',
      addedIds: [],
    });
  });

  it('replaces a still-open notice that the new one fully covers', () => {
    raise([github], { anchorId: 'm.1' });
    raise([github, alice], { anchorId: 'm.2' });
    const notices = useMentionNoticeStore.getState().notices;
    expect(notices).toHaveLength(1);
    expect(notices[0].anchorId).toBe('m.2');
  });

  it('keeps notices from other rooms, threads and settled states', () => {
    const first = raise([github]);
    useMentionNoticeStore.getState().update(first, { status: 'failed' });
    raise([github], { conversationKey: '!room:b' });
    raise([github], { threadRootId: '$root' });
    raise([github]);
    expect(useMentionNoticeStore.getState().notices).toHaveLength(4);
  });

  it('updates and dismisses by id', () => {
    const id = raise([github]);
    useMentionNoticeStore
      .getState()
      .update(id, { status: 'added', addedIds: [github.id] });
    expect(useMentionNoticeStore.getState().notices[0].status).toBe('added');
    useMentionNoticeStore.getState().dismiss(id);
    expect(useMentionNoticeStore.getState().notices).toHaveLength(0);
  });

  it('dismissAll clears every room', () => {
    raise([github]);
    raise([alice], { conversationKey: '!room:b' });
    useMentionNoticeStore.getState().dismissAll();
    expect(useMentionNoticeStore.getState().notices).toHaveLength(0);
  });
});
