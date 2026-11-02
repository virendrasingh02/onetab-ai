/**
 * Message bodies are markdown as the composer serialises it. These helpers
 * turn one into what list rows, previews and notifications show, so a
 * slash-command message reads the same wherever it appears.
 */

/** A message that is a slash-command invocation, e.g. `/asana create_task Fix login`. */
export interface CommandInvocation {
  /** Without the slash, e.g. `asana`. */
  command: string;
  /** A `snake_case` app action written straight after the command. */
  action?: string;
  /** Everything after the command (and action), still markdown. */
  rest: string;
}

const COMMAND_INVOCATION =
  /^\/([a-z][\w-]{0,31})(?:[ \t]+([a-z][a-z0-9]*(?:\\?_[a-z0-9]+)+))?(?=\s|$)/i;

/** Backslash-escaped markdown punctuation, e.g. `create\_task`. */
const ESCAPED_PUNCTUATION = /\\([\\`*_{}[\]()#+\-.!~>|])/g;

/**
 * Reads a slash-command invocation off the start of a message. A slash that
 * isn't a command — a path like `/usr/bin`, a date — returns `null`.
 */
export function parseCommandInvocation(body: string): CommandInvocation | null {
  const match = COMMAND_INVOCATION.exec(body.trimStart());
  if (!match) return null;
  const [token, command, action] = match;
  return {
    command,
    // The composer's markdown escapes `_`, so `create_task` arrives `create\_task`.
    action: action?.replace(/\\_/g, '_'),
    rest: body.trimStart().slice(token.length).replace(/^[ \t]+/, ''),
  };
}

/**
 * Flattens a markdown message body into one line of plain text: formatting
 * markers go, escaped punctuation comes back (`create\_task` → `create_task`),
 * and words joined by `_` keep it.
 */
export function toPlainMessageText(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+)/gm, '')
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^\w\\])[*_](?=\S)([^*_\n]*?\S)[*_](?![\w])/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(ESCAPED_PUNCTUATION, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
