import { EventStatus } from 'matrix-js-sdk';
import { describe, expect, it, vi } from 'vitest';
import { OneTabMatrixClient } from './matrix-client.js';

const ROOM = '!room:x';
const TARGET = '$target';
const ME = '@me:x';

interface FakeReaction {
  id: string;
  sender?: string;
  key?: string;
  status: EventStatus | null;
}

/** A client over a fake SDK whose reactions are the `relations` list. */
function setup(relations: FakeReaction[] = []) {
  const toEvent = (reaction: FakeReaction) => ({
    reaction,
    status: reaction.status,
    getId: () => reaction.id,
    getSender: () => reaction.sender ?? ME,
    getRelation: () => ({ key: reaction.key ?? '👍' }),
    isRedacted: () => false,
  });
  const room = {
    roomId: ROOM,
    findEventById: () => undefined,
    getUnfilteredTimelineSet: () => ({
      relations: {
        getChildEventsForEvent: () => ({
          getRelations: () => relations.map(toEvent),
        }),
      },
    }),
  };
  const sdk = {
    getRoom: () => room,
    getUserId: () => ME,
    sendEvent: vi.fn(),
    redactEvent: vi.fn().mockResolvedValue({}),
    cancelPendingEvent: vi.fn((event: ReturnType<typeof toEvent>) => {
      relations.splice(relations.indexOf(event.reaction), 1);
    }),
  };
  const client = new OneTabMatrixClient({
    homeserverUrl: 'http://x',
    sessionStore: {} as never,
  });
  Reflect.set(client, 'sdk', sdk);
  return { client, sdk, relations };
}

const forbidden = Object.assign(new Error('nope'), {
  errcode: 'M_FORBIDDEN',
  httpStatus: 403,
});

describe('reactions', () => {
  it('takes back the local echo when the send fails', async () => {
    const { client, sdk, relations } = setup();
    sdk.sendEvent.mockImplementation(async () => {
      relations.push({ id: '~local', status: EventStatus.NOT_SENT });
      throw forbidden;
    });

    await expect(client.react(ROOM, TARGET, '👍')).rejects.toThrow();

    expect(sdk.cancelPendingEvent).toHaveBeenCalledTimes(1);
    expect(relations).toEqual([]);
  });

  it('leaves other people’s reactions alone when a send fails', async () => {
    const other = { id: '$other', sender: '@a:x', status: null };
    const { client, sdk, relations } = setup([other]);
    sdk.sendEvent.mockRejectedValue(forbidden);

    await expect(client.react(ROOM, TARGET, '👍')).rejects.toThrow();

    expect(relations).toEqual([other]);
  });

  it('does not send a reaction the user already has', async () => {
    const { client, sdk } = setup([{ id: '$mine', status: null }]);

    await client.react(ROOM, TARGET, '👍');

    expect(sdk.sendEvent).not.toHaveBeenCalled();
  });

  it('can retry after a failed send', async () => {
    const { client, sdk } = setup([
      { id: '~failed', status: EventStatus.NOT_SENT },
    ]);
    sdk.sendEvent.mockResolvedValue({ event_id: '$sent' });

    await client.react(ROOM, TARGET, '👍');

    expect(sdk.sendEvent).toHaveBeenCalledTimes(1);
  });

  it('waits for a reaction still sending before removing it', async () => {
    const { client, sdk, relations } = setup();
    const mine: FakeReaction = { id: '~local', status: EventStatus.SENDING };
    let finishSend = () => undefined as void;
    sdk.sendEvent.mockImplementation(() => {
      relations.push(mine);
      return new Promise<void>((resolve) => {
        finishSend = () => {
          mine.id = '$sent';
          mine.status = null;
          resolve();
        };
      });
    });

    const adding = client.react(ROOM, TARGET, '👍');
    await vi.waitFor(() => expect(sdk.sendEvent).toHaveBeenCalled());
    const removing = client.removeReaction(ROOM, TARGET, '👍');
    await Promise.resolve();
    expect(sdk.redactEvent).not.toHaveBeenCalled();

    finishSend();
    await Promise.all([adding, removing]);

    expect(sdk.redactEvent).toHaveBeenCalledWith(
      ROOM,
      '$sent',
      undefined,
      undefined,
    );
  });
});
