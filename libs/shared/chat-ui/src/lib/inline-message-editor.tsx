import { Button } from '@org/ui';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import {
  LexicalComposerInput,
  type LexicalEditorRef,
  type MentionCandidate,
} from './lexical-composer.js';

export interface InlineMessageEditorProps {
  /** The message's current markdown — also the baseline for "unchanged". */
  initialMarkdown: string;
  onSave: (markdown: string) => void | Promise<void>;
  onCancel: () => void;
  members?: MentionCandidate[];
  channelMentions?: MentionCandidate[];
  /** Mirrors the composer: when false, Enter is a newline and Ctrl/Cmd+Enter saves. */
  enterToSend?: boolean;
}

/**
 * Edits a message in place, where it sits in the timeline. Enter saves,
 * Escape cancels, and the footer states both so nobody has to guess.
 *
 * Save stays disabled until the text actually differs and is non-empty, so an
 * accidental open-then-confirm never produces a spurious "(edited)" tag.
 */
export function InlineMessageEditor({
  initialMarkdown,
  onSave,
  onCancel,
  members,
  channelMentions,
  enterToSend = true,
}: InlineMessageEditorProps) {
  const editorRef = useRef<LexicalEditorRef | null>(null);
  const [draft, setDraft] = useState(initialMarkdown);
  const [saving, setSaving] = useState(false);

  const trimmed = draft.trim();
  const canSave =
    !saving && trimmed.length > 0 && trimmed !== initialMarkdown.trim();

  const commit = useCallback(
    async (markdown: string) => {
      const next = markdown.trim();
      if (!next || saving) return;
      if (next === initialMarkdown.trim()) {
        onCancel();
        return;
      }
      setSaving(true);
      try {
        await onSave(next);
      } finally {
        setSaving(false);
      }
    },
    [initialMarkdown, onCancel, onSave, saving],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The mention / slash menus claim Escape first and mark it handled.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="my-1 w-full overflow-hidden rounded-xl border border-primary/40 bg-background shadow-xs focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/15"
    >
      <LexicalComposerInput
        autoFocus
        showToolbar={false}
        initialMarkdown={initialMarkdown}
        enterToSend={enterToSend}
        members={members}
        channelMentions={channelMentions}
        onDraftChange={setDraft}
        onEmptyChange={(isEmpty) => {
          if (isEmpty) setDraft('');
        }}
        onSend={(text) => commit(text)}
        onRegisterRef={(ref) => {
          editorRef.current = ref;
          // Land the caret at the end of the existing text, not the start.
          ref.focus();
        }}
      />
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {enterToSend ? 'Enter' : 'Ctrl+Enter'} to save ·{' '}
          <kbd className="font-sans">Esc</kbd> to cancel
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSave}
          onClick={() => void commit(editorRef.current?.getMarkdown() ?? draft)}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
