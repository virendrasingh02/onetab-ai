import { create } from 'zustand';

/*
 * A one-shot "put this in the composer" channel. Message actions (Quote) live
 * on the bubble, far from the composer that owns the Lexical editor; rather
 * than thread an editor ref through the message list, the action posts a
 * request here and the composer bound to that conversation consumes it.
 */

export interface ComposerInsertRequest {
  conversationId: string;
  markdown: string;
  nonce: number;
}

interface ComposerInsertState {
  request: ComposerInsertRequest | null;
  insert: (conversationId: string, markdown: string) => void;
  consume: (nonce: number) => void;
}

let nonce = 0;

export const useComposerInsertStore = create<ComposerInsertState>()((set, get) => ({
  request: null,
  insert: (conversationId, markdown) =>
    set({ request: { conversationId, markdown, nonce: ++nonce } }),
  consume: (done) => {
    if (get().request?.nonce === done) set({ request: null });
  },
}));

/** Markdown block-quote of a message body, ready to be replied under. */
export function quoteMarkdown(body: string, senderName?: string): string {
  const quoted = body
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return senderName ? `${quoted}\n> — ${senderName}\n\n` : `${quoted}\n\n`;
}

/** Ask the composer for `conversationId` to append `markdown` and take focus. */
export function insertIntoComposer(conversationId: string, markdown: string): void {
  useComposerInsertStore.getState().insert(conversationId, markdown);
}
