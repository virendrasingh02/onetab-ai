import { describe, expect, it } from 'vitest';
import {
  applySuggestion,
  filterCommands,
  filterMentions,
  readSuggestionTrigger,
  stripMentions,
  type SuggestionTrigger,
} from './ai-suggestions.js';

/** Reads the trigger at `caret` (the end of the string by default), or throws. */
const triggerFor = (value: string, caret = value.length): SuggestionTrigger => {
  const trigger = readSuggestionTrigger(value, caret);
  if (!trigger) throw new Error(`expected a trigger in ${JSON.stringify(value)}`);
  return trigger;
};

describe('readSuggestionTrigger', () => {
  it('opens on a bare @ or / at the caret', () => {
    expect(readSuggestionTrigger('@', 1)).toMatchObject({
      kind: 'mention',
      query: '',
      start: 0,
    });
    expect(readSuggestionTrigger('/', 1)).toMatchObject({
      kind: 'command',
      query: '',
      start: 0,
    });
  });

  it('collects what has been typed after the trigger', () => {
    expect(readSuggestionTrigger('ask @anth', 9)).toMatchObject({
      kind: 'mention',
      query: 'anth',
      start: 4,
      end: 9,
    });
  });

  it('only triggers at a word boundary', () => {
    // An email address must not open the model list halfway through typing.
    expect(readSuggestionTrigger('mail me@example', 15)).toBeNull();
    // Nor a URL's closing slash the command list.
    expect(readSuggestionTrigger('see docs/setup', 14)).toBeNull();
  });

  it('closes once the token is finished', () => {
    expect(readSuggestionTrigger('@anthropic summarise', 20)).toBeNull();
  });

  it('reads the token the caret sits in, not the last one typed', () => {
    const value = '@openai and @gemini';
    expect(readSuggestionTrigger(value, 7)).toMatchObject({ query: 'openai' });
  });
});

describe('applySuggestion', () => {
  it('replaces the typed token and leaves a trailing space', () => {
    const value = 'ask @anth';
    const applied = applySuggestion(value, triggerFor(value), '@anthropic');

    expect(applied.value).toBe('ask @anthropic ');
    expect(applied.caret).toBe(applied.value.length);
  });

  it('keeps the rest of the line intact', () => {
    const value = 'ask @ate the end';
    const applied = applySuggestion(value, triggerFor(value, 6), '@auto');

    expect(applied.value).toBe('ask @auto te the end');
  });

  it('does not add a space when the command brings its own', () => {
    const value = '/sum';
    const applied = applySuggestion(value, triggerFor(value), 'Summarize:\n\n');

    expect(applied.value).toBe('Summarize:\n\n');
    expect(applied.caret).toBe(applied.value.length);
  });
});

describe('stripMentions', () => {
  it('takes model tokens back out before the prompt is sent', () => {
    expect(stripMentions('@anthropic what shipped this week?')).toBe(
      'what shipped this week?',
    );
    expect(stripMentions('summarise @gemini the thread')).toBe(
      'summarise the thread',
    );
  });

  it('leaves ordinary text with an @ alone', () => {
    expect(stripMentions('email me@example.com')).toBe('email me@example.com');
    expect(stripMentions('ping @designers')).toBe('ping @designers');
  });

  it('preserves line breaks in a multi-line prompt', () => {
    expect(stripMentions('@openai Summarize:\n\nthe notes')).toBe(
      'Summarize:\n\nthe notes',
    );
  });
});

describe('filtering', () => {
  it('matches mentions on handle or label', () => {
    expect(filterMentions('nemotron').map((m) => m.handle)).toEqual(['nemotron']);
    expect(filterMentions('nvidia').map((m) => m.handle)).toEqual(['nemotron']);
    expect(filterMentions('anth').map((m) => m.handle)).toEqual(['anthropic']);
    expect(filterMentions('claude').map((m) => m.handle)).toEqual(['anthropic']);
  });

  it('matches commands on name or hint', () => {
    expect(filterCommands('sum').map((c) => c.name)).toEqual(['summarize']);
    expect(filterCommands('zzzz')).toEqual([]);
  });

  it('returns the whole catalogue for an empty query', () => {
    expect(filterMentions('').length).toBeGreaterThan(1);
    expect(filterCommands('').length).toBeGreaterThan(1);
  });
});
