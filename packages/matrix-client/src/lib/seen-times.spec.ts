import { describe, expect, it } from 'vitest';
import {
  noteReceiptPosition,
  recordReceipt,
  recordedSeenAt,
  type SeenTimesRoom,
} from './seen-times.js';

const alice = '@alice:example.org';

/** A room whose live timeline holds the given event ids, oldest first. */
function fakeRoom(ids: string[]): SeenTimesRoom {
  const events = ids.map((id) => ({ getId: () => id }));
  return {
    getLiveTimeline: () => ({ getEvents: () => events }),
  } as unknown as SeenTimesRoom;
}

describe('seen times', () => {
  it('only knows the receipt event itself when the previous position is unknown', () => {
    const room = fakeRoom(['$1', '$2', '$3']);
    recordReceipt(room, alice, '$3', 3000);

    expect(recordedSeenAt(room, alice, '$3')).toBe(3000);
    expect(recordedSeenAt(room, alice, '$2')).toBeUndefined();
  });

  it('stamps every message a receipt newly covers with that receipt time', () => {
    const room = fakeRoom(['$1', '$2', '$3', '$4', '$5']);
    noteReceiptPosition(room, alice, '$2', 1000);
    recordReceipt(room, alice, '$5', 5000);

    expect(recordedSeenAt(room, alice, '$2')).toBe(1000);
    expect(recordedSeenAt(room, alice, '$3')).toBe(5000);
    expect(recordedSeenAt(room, alice, '$4')).toBe(5000);
    expect(recordedSeenAt(room, alice, '$5')).toBe(5000);
    expect(recordedSeenAt(room, alice, '$1')).toBeUndefined();
  });

  it('keeps the first time a message was seen', () => {
    const room = fakeRoom(['$1', '$2', '$3']);
    recordReceipt(room, alice, '$1', 1000);
    recordReceipt(room, alice, '$2', 2000);
    recordReceipt(room, alice, '$3', 3000);

    expect(recordedSeenAt(room, alice, '$2')).toBe(2000);
    expect(recordedSeenAt(room, alice, '$3')).toBe(3000);
  });

  it('does not let a mapped position override a live one', () => {
    const room = fakeRoom(['$1', '$2', '$3']);
    recordReceipt(room, alice, '$2', 2000);
    noteReceiptPosition(room, alice, '$1', 1000);
    recordReceipt(room, alice, '$3', 3000);

    expect(recordedSeenAt(room, alice, '$1')).toBeUndefined();
    expect(recordedSeenAt(room, alice, '$3')).toBe(3000);
  });
});
