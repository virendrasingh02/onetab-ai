import { MarkdownMessage } from '@org/chat-ui';
import type { TaskComment, WorkItemActivity } from '@org/types';
import { Button, confirm, Skeleton, Textarea, UserAvatar } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { MessageSquare, Pencil, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { BoardMember } from '../types.js';
import {
  buildTimeline,
  type ActivityFilter,
  type ActivityLookups,
} from './activity-feed.js';

const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
];

export interface ActivityPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/** A person's name (or avatar) that opens their profile in the right rail. */
function PersonLink({
  person,
  onOpen,
  className,
  children,
}: {
  person: ActivityPerson | undefined;
  onOpen: (person: ActivityPerson) => void;
  className?: string;
  children: ReactNode;
}) {
  if (!person) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(person)}
      title={`View ${person.name}'s profile`}
      className={cn(
        'rounded-sm text-left outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Older entries wait behind a button, so a long-lived task opens quickly. */
const RECENT_ENTRIES = 50;

function CommentEntry({
  comment,
  mentionNames,
  canEdit,
  canDelete,
  saving,
  onSave,
  onDelete,
  onOpenPerson,
  onMentionClick,
}: {
  comment: TaskComment;
  mentionNames: string[];
  onOpenPerson: (person: ActivityPerson) => void;
  onMentionClick: (mention: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  saving: boolean;
  onSave: (content: string, onSaved: () => void) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const author = comment.author.displayName ?? comment.author.name;
  const authorPerson: ActivityPerson = {
    id: comment.author.id,
    name: author,
    avatarUrl: comment.author.avatarUrl,
  };
  const edited =
    new Date(comment.updatedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000;

  const save = () => {
    const content = draft?.trim();
    if (!content) return;
    if (content === comment.content) {
      setDraft(null);
      return;
    }
    onSave(content, () => setDraft(null));
  };

  const handleDelete = () => {
    void confirm({
      title: 'Delete this comment?',
      description: "It's removed for everyone. This can't be undone.",
      confirmLabel: 'Delete comment',
      destructive: true,
    }).then((ok) => {
      if (ok) onDelete();
    });
  };

  return (
    <div className="group gap-2.5 flex">
      <PersonLink
        person={authorPerson}
        onOpen={onOpenPerson}
        className="h-fit shrink-0 rounded-full hover:no-underline"
      >
        <UserAvatar
          name={author}
          seed={comment.author.id}
          src={comment.author.avatarUrl ?? undefined}
          size="sm"
        />
      </PersonLink>
      <div className="min-w-0 px-3 py-2 flex-1 rounded-xl border border-border/60 bg-surface">
        <div className="min-h-5 gap-2 flex items-center">
          <PersonLink
            person={authorPerson}
            onOpen={onOpenPerson}
            className="text-xs font-semibold min-w-0 truncate text-foreground"
          >
            {author}
          </PersonLink>
          <span className="shrink-0 text-meta text-muted-foreground">
            {formatRelative(comment.createdAt)}
            {edited ? ' · edited' : ''}
          </span>
          {draft === null ? (
            <span className="gap-0.5 ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setDraft(comment.content)}
                  aria-label="Edit comment"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3" aria-hidden />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete comment"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              ) : null}
            </span>
          ) : null}
        </div>

        {draft !== null ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              autoFocus
              minRows={2}
              maxLength={5000}
              value={draft}
              aria-label="Edit comment"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setDraft(null);
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  save();
                }
              }}
              className="text-sm"
            />
            <div className="gap-2 flex">
              <Button
                size="sm"
                onClick={save}
                loading={saving}
                disabled={!draft.trim()}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MarkdownMessage
            text={comment.content}
            mentionNames={mentionNames}
            onMentionClick={onMentionClick}
            className="text-sm"
          />
        )}
      </div>
    </div>
  );
}

export interface CardActivityProps {
  comments: TaskComment[];
  activities: WorkItemActivity[];
  loading: boolean;
  lookups: ActivityLookups;
  members: BoardMember[];
  currentUserId: string | undefined;
  canComment: boolean;
  /** May delete other people's comments, not just their own. */
  canModerate: boolean;
  savingComment: boolean;
  onEditComment: (
    commentId: string,
    content: string,
    onSaved: () => void,
  ) => void;
  onDeleteComment: (commentId: string) => void;
  onOpenPerson: (person: ActivityPerson) => void;
}

export function CardActivity({
  comments,
  activities,
  loading,
  lookups,
  members,
  currentUserId,
  canComment,
  canModerate,
  savingComment,
  onEditComment,
  onDeleteComment,
  onOpenPerson,
}: CardActivityProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const timeline = useMemo(
    () => buildTimeline(comments, activities, lookups, filter, query),
    [comments, activities, lookups, filter, query],
  );
  const hidden = showAll ? 0 : Math.max(0, timeline.length - RECENT_ENTRIES);
  const visible = hidden > 0 ? timeline.slice(hidden) : timeline;

  const mentionNames = useMemo(
    () =>
      members.flatMap((member) =>
        member.displayName ? [member.displayName, member.name] : [member.name],
      ),
    [members],
  );

  /* A chip carries the name as typed; the longest member name wins. */
  const openMention = (mention: string) => {
    const typed = mention.replace(/^@/, '').toLowerCase();
    const member = members.find(
      (entry) =>
        entry.name.toLowerCase() === typed ||
        entry.displayName?.toLowerCase() === typed,
    );
    if (member) {
      onOpenPerson({
        id: member.id,
        name: member.displayName ?? member.name,
        avatarUrl: member.avatarUrl,
      });
    }
  };

  return (
    <section aria-label="Activity">
      <div className="min-h-7 gap-2 flex flex-wrap items-center justify-between">
        <h3 className="gap-1.5 text-sm font-semibold flex items-center text-foreground">
          <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
          Activity
        </h3>
        <div className="gap-1 flex items-center">
          <div
            role="group"
            aria-label="Filter activity"
            className="gap-0.5 p-0.5 flex items-center rounded-btn bg-muted/50"
          >
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={cn(
                  'px-2 py-0.5 font-medium rounded-[calc(var(--radius-btn)-2px)] text-meta transition-colors',
                  filter === option.id
                    ? 'shadow-2xs bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
                {option.id === 'comments' && comments.length > 0
                  ? ` ${comments.length}`
                  : ''}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={searching ? 'Close search' : 'Search activity'}
            aria-pressed={searching}
            onClick={() => {
              setSearching(!searching);
              setQuery('');
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {searching ? (
              <X className="size-3.5" aria-hidden />
            ) : (
              <Search className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {searching ? (
        <input
          autoFocus
          value={query}
          aria-label="Search activity"
          placeholder="Search comments and history…"
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 h-8 px-2.5 text-xs w-full rounded-md border border-border bg-surface text-foreground outline-none focus:border-ring"
        />
      ) : null}

      <div className="mt-3 space-y-3">
        {loading ? (
          <div className="space-y-2" aria-label="Loading activity">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            {query
              ? 'Nothing matches that search.'
              : filter === 'history'
                ? 'No changes yet.'
                : 'No comments yet.'}
          </p>
        ) : null}

        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Show {hidden} older {hidden === 1 ? 'entry' : 'entries'}
          </button>
        ) : null}

        {visible.map((entry) => {
          if (entry.kind === 'comment') {
            const isOwn = entry.comment.author.id === currentUserId;
            return (
              <CommentEntry
                key={entry.id}
                comment={entry.comment}
                mentionNames={mentionNames}
                canEdit={isOwn && canComment}
                canDelete={(isOwn && canComment) || canModerate}
                saving={savingComment}
                onSave={(content, onSaved) =>
                  onEditComment(entry.comment.id, content, onSaved)
                }
                onDelete={() => onDeleteComment(entry.comment.id)}
                onOpenPerson={onOpenPerson}
                onMentionClick={openMention}
              />
            );
          }

          const actor =
            entry.actor?.displayName ?? entry.actor?.name ?? 'Someone';
          const actorPerson = entry.actor
            ? {
                id: entry.actor.id,
                name: actor,
                avatarUrl: entry.actor.avatarUrl,
              }
            : undefined;
          return (
            <div
              key={entry.id}
              className="gap-2.5 pl-1.5 text-xs flex items-start text-muted-foreground"
            >
              <PersonLink
                person={actorPerson}
                onOpen={onOpenPerson}
                className="shrink-0 rounded-full hover:no-underline"
              >
                <UserAvatar
                  name={actor}
                  seed={entry.actor?.id ?? actor}
                  src={entry.actor?.avatarUrl ?? undefined}
                  size="xs"
                />
              </PersonLink>
              <p className="min-w-0 leading-5 break-words">
                <PersonLink
                  person={actorPerson}
                  onOpen={onOpenPerson}
                  className="font-medium text-foreground"
                >
                  {actor}
                </PersonLink>{' '}
                {entry.text}
                <span className="text-muted-foreground/70">
                  {' · '}
                  {formatRelative(entry.at)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
