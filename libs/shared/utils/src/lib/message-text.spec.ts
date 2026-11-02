import { describe, expect, it } from 'vitest';
import { parseCommandInvocation, toPlainMessageText } from './message-text.js';

describe('parseCommandInvocation', () => {
  it('reads the command, an escaped snake_case action and the rest', () => {
    expect(parseCommandInvocation('/asana create\\_task design website')).toEqual({
      command: 'asana',
      action: 'create_task',
      rest: 'design website',
    });
  });

  it('reads a command with no action', () => {
    expect(parseCommandInvocation('/remind me in 5 minutes')).toEqual({
      command: 'remind',
      action: undefined,
      rest: 'me in 5 minutes',
    });
  });

  it('ignores slashes that are not commands', () => {
    expect(parseCommandInvocation('/usr/bin is a path')).toBeNull();
    expect(parseCommandInvocation('and/or')).toBeNull();
  });
});

describe('toPlainMessageText', () => {
  it('unescapes punctuation and keeps snake_case words', () => {
    expect(toPlainMessageText('/asana create\\_task in **bold**')).toBe(
      '/asana create_task in bold',
    );
    expect(toPlainMessageText('user_id_field and _emphasis_')).toBe(
      'user_id_field and emphasis',
    );
  });

  it('flattens links, quotes and line breaks', () => {
    expect(toPlainMessageText('> quoted\n[docs](https://x.y) `code`')).toBe(
      'quoted docs code',
    );
  });
});
