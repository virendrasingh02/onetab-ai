/**
 * Horizontal padding for a full-width timeline row.
 *
 * Rows span the whole pane so their hover, saved and pinned tints reach both
 * edges; this insets only their content to the chat width (`--chat-gutter`,
 * unset → just the 1rem row padding). It belongs on the element that carries
 * the tint: on a parent, the tint stops at the column.
 */
export const CHAT_ROW_INSET = 'px-[calc(var(--chat-gutter,0px)_+_1rem)]';

/** {@link CHAT_ROW_INSET} at compact density. */
export const CHAT_ROW_INSET_COMPACT =
  'px-[calc(var(--chat-gutter,0px)_+_0.75rem)]';

/** The neutral hover wash every timeline row shares. */
export const CHAT_ROW_HOVER = 'hover:bg-foreground/[0.035]';

/**
 * A complete timeline row: full-width hover tint, content inset to the chat
 * column. Used by cards (form, approval, call summary…) and client-only rows.
 */
export const CHAT_ROW = `${CHAT_ROW_INSET} ${CHAT_ROW_HOVER} transition-colors`;

/** The jump-to-message flash, the same on every row type. */
export const CHAT_ROW_HIGHLIGHT = 'message-flash';
