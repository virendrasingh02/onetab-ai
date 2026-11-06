import { queryKeys, uploadApi } from '@org/api-client';
import {
  Button,
  Textarea,
  toast,
  UnifiedEmojiPickerPopover,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AtSign, Paperclip, Send, Smile } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type { BoardMember } from '../types.js';

const draftKey = (cardId: string) => `card-comment-draft:${cardId}`;

function readDraft(cardId: string): string {
  try {
    return sessionStorage.getItem(draftKey(cardId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(cardId: string, text: string) {
  try {
    if (text) sessionStorage.setItem(draftKey(cardId), text);
    else sessionStorage.removeItem(draftKey(cardId));
  } catch {
    // Without storage the draft only lives as long as the card is open.
  }
}

/** The `@query` the caret is inside, if any: names can hold spaces. */
export function activeMention(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1] ?? '')) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || query.includes('\n')) return null;
  return { start: at, query };
}

const memberLabel = (member: BoardMember) => member.displayName ?? member.name;

export interface CardCommentComposerProps {
  workspaceId: string | undefined;
  cardId: string;
  members: BoardMember[];
  canComment: boolean;
  sending: boolean;
  /** Text to drop into the box, e.g. a Brain² summary to review before posting. */
  prefill: string | null;
  onPrefillTaken: () => void;
  /** Resolves once the comment was sent or durably queued. */
  onSend: (content: string, onSent: () => void) => void;
}

export function CardCommentComposer({
  workspaceId,
  cardId,
  members,
  canComment,
  sending,
  prefill,
  onPrefillTaken,
  onSend,
}: CardCommentComposerProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(() => readDraft(cardId));
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => writeDraft(cardId, text), [cardId, text]);

  useEffect(() => {
    if (prefill === null) return;
    setText((current) => (current ? `${current}\n\n${prefill}` : prefill));
    onPrefillTaken();
    fieldRef.current?.focus();
  }, [prefill, onPrefillTaken]);

  const mention = mentionDismissed ? null : activeMention(text, caret);
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const needle = mention.query.toLowerCase();
    return members
      .filter((member) => memberLabel(member).toLowerCase().includes(needle))
      .slice(0, 6);
  }, [mention, members]);
  const showSuggestions = suggestions.length > 0;

  const placeCaret = (position: number) => {
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(position, position);
      setCaret(position);
    });
  };

  const insertAtCaret = (snippet: string) => {
    const at = fieldRef.current?.selectionStart ?? text.length;
    setText(text.slice(0, at) + snippet + text.slice(at));
    setMentionDismissed(false);
    placeCaret(at + snippet.length);
  };

  const pickMention = (member: BoardMember) => {
    if (!mention) return;
    const snippet = `@${memberLabel(member)} `;
    setText(text.slice(0, mention.start) + snippet + text.slice(caret));
    setHighlight(0);
    placeCaret(mention.start + snippet.length);
  };

  const send = () => {
    const content = text.trim();
    if (!content || sending) return;
    // A failed attempt leaves the text in place to retry.
    onSend(content, () => setText(''));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight(
          (highlight + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const member = suggestions[highlight] ?? suggestions[0];
        if (member) pickMention(member);
        return;
      }
      if (event.key === 'Escape') {
        setMentionDismissed(true);
        return;
      }
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const attach = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await uploadApi.upload(workspaceId as string, file, {
          contextType: 'ISSUE',
          contextId: cardId,
        });
      }
      return files;
    },
    onSuccess: (files) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.uploads.all(workspaceId ?? ''),
      });
      toast.success(
        files.length === 1
          ? `${files[0]?.name} added to Attachments`
          : `${files.length} files added to Attachments`,
      );
      insertAtCaret(files.map((file) => `📎 ${file.name}`).join('\n'));
    },
    meta: { errorMessage: 'Could not upload that file.' },
  });

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) attach.mutate(files);
  };

  if (!canComment) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        You can read this conversation, but your role can't comment here.
      </p>
    );
  }

  return (
    <div className="shadow-2xs relative rounded-xl border border-border bg-surface transition-colors focus-within:border-ring">
      {showSuggestions ? (
        <div
          role="listbox"
          aria-label="Mention someone"
          className="left-0 mb-1 w-64 p-1 shadow-xl absolute bottom-full z-10 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground"
        >
          {suggestions.map((member, index) => (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickMention(member)}
              className={cn(
                'gap-2 px-2 py-1.5 text-xs flex w-full items-center rounded-md text-left',
                index === highlight ? 'bg-accent' : 'hover:bg-accent/60',
              )}
            >
              <UserAvatar
                name={memberLabel(member)}
                seed={member.id}
                src={member.avatarUrl}
                size="xs"
              />
              <span className="truncate">{memberLabel(member)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <Textarea
        ref={fieldRef}
        minRows={1}
        maxRows={8}
        maxLength={5000}
        value={text}
        aria-label="Write a comment"
        placeholder="Write a comment… @ to mention"
        onChange={(event) => {
          setText(event.target.value);
          setCaret(event.target.selectionStart);
          setHighlight(0);
          setMentionDismissed(false);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={handleKeyDown}
        className="min-h-0 px-3 pt-2.5 pb-1 text-sm rounded-xl border-0 bg-transparent focus-visible:ring-0"
      />

      <div className="px-2 pb-1.5 flex items-center justify-between">
        <div className="gap-0.5 flex items-center text-muted-foreground">
          <button
            type="button"
            onClick={() => insertAtCaret('@')}
            aria-label="Mention someone"
            title="Mention someone"
            className="rounded p-1 hover:bg-muted hover:text-foreground"
          >
            <AtSign className="size-3.5" aria-hidden />
          </button>
          <UnifiedEmojiPickerPopover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            closeOnEmojiSelect
            onEmojiSelect={(selection) => insertAtCaret(selection.emoji)}
          >
            <button
              type="button"
              aria-label="Add an emoji"
              title="Add an emoji"
              className="rounded p-1 hover:bg-muted hover:text-foreground"
            >
              <Smile className="size-3.5" aria-hidden />
            </button>
          </UnifiedEmojiPickerPopover>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={attach.isPending}
            aria-label="Attach a file"
            title="Attach a file"
            className="rounded p-1 hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Paperclip className="size-3.5" aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleFiles}
          />
        </div>

        <div className="gap-2 flex items-center">
          <span className="sm:inline hidden text-[11px] text-muted-foreground/80">
            Shift+Enter for a new line
          </span>
          <Button
            type="button"
            size="icon-sm"
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Send comment"
            className="size-7"
          >
            <Send className="size-3" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
