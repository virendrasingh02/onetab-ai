import { AI_MODELS, type AIModelValue } from './ai-models.js';

/**
 * The `@` and `/` vocabularies shared by every AI composer in the app.
 *
 * Kept as plain data in its own module — no React, no hooks — so the parsing
 * rules below can be reasoned about (and tested) without mounting a textarea.
 */

/* ------------------------------------------------------------- mentions --- */

export interface AIMention {
  /** The typed token, without the `@`. */
  handle: string;
  label: string;
  /** Model this mention switches the turn to. */
  model: AIModelValue;
}

/**
 * Mentions are the models, not people.
 *
 * `@` here is a control, not content: picking one switches the model for the
 * turn, which is why `stripMentions` takes the token back out before the
 * transcript goes to the API — the model should not have to read its own name.
 */
export const AI_MENTIONS: readonly AIMention[] = AI_MODELS.map((option) => ({
  handle: option.value,
  label: option.label,
  model: option.value,
}));

const MENTION_TOKEN = new RegExp(
  `(^|\\s)@(?:${AI_MENTIONS.map((mention) => mention.handle).join('|')})\\b`,
  'gi',
);

/** Removes `@model` tokens from a prompt, preserving the surrounding spacing. */
export function stripMentions(text: string): string {
  return text
    .replace(MENTION_TOKEN, '$1')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

/* ------------------------------------------------------------- commands --- */

export interface AICommand {
  /** The typed token, without the `/`. */
  name: string;
  hint: string;
  /**
   * What the command expands to in the composer.
   *
   * Commands are prompt scaffolding rather than a second API: they drop
   * editable text in front of the caret, so what gets sent is always exactly
   * what the composer shows.
   */
  prompt: string;
}

export const AI_COMMANDS: readonly AICommand[] = [
  {
    name: 'summarize',
    hint: 'Condense a thread, doc or transcript',
    prompt: 'Summarize the following, keeping the decisions and owners:\n\n',
  },
  {
    name: 'explain',
    hint: 'Break something down in plain language',
    prompt: 'Explain the following in plain language:\n\n',
  },
  {
    name: 'plan',
    hint: 'Turn a goal into ordered steps',
    prompt:
      'Break this goal into an ordered plan with owners and rough effort:\n\n',
  },
  {
    name: 'rewrite',
    hint: 'Tighten wording without losing meaning',
    prompt: 'Rewrite the following to be clearer and shorter:\n\n',
  },
  {
    name: 'translate',
    hint: 'Convert text to another language',
    prompt: 'Translate the following into English:\n\n',
  },
  {
    name: 'brainstorm',
    hint: 'Generate options to react to',
    prompt: 'Brainstorm ten distinct ideas for: ',
  },
  {
    name: 'draft',
    hint: 'Start a message or announcement',
    prompt: 'Draft a short, friendly message about: ',
  },
];

/* -------------------------------------------------------------- parsing --- */

export type SuggestionKind = 'mention' | 'command';

export interface SuggestionTrigger {
  kind: SuggestionKind;
  /** What has been typed after the trigger character so far. */
  query: string;
  /** Index of the `@` or `/` in the value. */
  start: number;
  /** Index just past the query — where a replacement ends. */
  end: number;
}

/*
 * A trigger only counts at the start of a word. Without the leading boundary
 * an email address opens the model list halfway through typing, and every
 * closing slash of a URL opens the command list.
 */
const TRIGGER_AT_CARET = /(?:^|\s)([@/])([\p{L}\p{N}_-]*)$/u;

/** Reads the suggestion trigger the caret currently sits inside, if any. */
export function readSuggestionTrigger(
  value: string,
  caret: number,
): SuggestionTrigger | null {
  const match = TRIGGER_AT_CARET.exec(value.slice(0, caret));
  if (!match) return null;

  const [, symbol, query] = match;
  return {
    kind: symbol === '@' ? 'mention' : 'command',
    query,
    start: caret - query.length - 1,
    end: caret,
  };
}

export interface SuggestionApplied {
  value: string;
  /** Where the caret belongs once the replacement is in. */
  caret: number;
}

/** Replaces the triggering token with `insert`, leaving the caret after it. */
export function applySuggestion(
  value: string,
  trigger: SuggestionTrigger,
  insert: string,
): SuggestionApplied {
  const before = value.slice(0, trigger.start);
  const after = value.slice(trigger.end);

  // Commands already end in their own whitespace; mentions need a separator.
  const needsGap = !/\s$/.test(insert) && !after.startsWith(' ');
  const inserted = needsGap ? `${insert} ` : insert;

  return {
    value: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  };
}

const matches = (candidate: string, query: string) =>
  candidate.toLowerCase().includes(query.toLowerCase());

export function filterMentions(query: string): AIMention[] {
  if (!query) return [...AI_MENTIONS];
  return AI_MENTIONS.filter(
    (mention) => matches(mention.handle, query) || matches(mention.label, query),
  );
}

export function filterCommands(query: string): AICommand[] {
  if (!query) return [...AI_COMMANDS];
  return AI_COMMANDS.filter(
    (command) => matches(command.name, query) || matches(command.hint, query),
  );
}
