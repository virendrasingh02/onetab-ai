import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  toPresenceStatus,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { Hash, Lock, Search, X } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/** A person, AI agent or connected app that can receive a message. */
export interface RecipientPerson {
  id: string;
  /** Display name shown on the row and the token. */
  name: string;
  /** The `@handle`, shown under the name. */
  handle: string;
  avatarUrl?: string | null;
  presence?: string | null;
  kind: 'person' | 'agent' | 'app';
  /** The viewer's own row — pinned first and tagged "You". */
  isSelf?: boolean;
  statusText?: string | null;
}

/** A channel the viewer may post to. */
export interface RecipientChannel {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
}

export interface NewMessageRecipientsProps {
  people: RecipientPerson[];
  channels: RecipientChannel[];
  /** Chosen people / agents / apps. */
  selectedPeopleIds: string[];
  onChangePeople: (ids: string[]) => void;
  /** A single chosen channel, mutually exclusive with people. */
  selectedChannelId: string | null;
  onChangeChannel: (id: string | null) => void;
  autoFocus?: boolean;
  className?: string;
}

type Row =
  | { type: 'channel'; channel: RecipientChannel }
  | { type: 'person'; person: RecipientPerson };

/**
 * The Slack-style "To:" field for a new message.
 *
 * Recipients are typed into the field itself: matches drop down as a grouped
 * list (channels first, then people, agents and apps), chosen ones sit inline
 * as removable tokens, and Backspace on an empty query peels off the last one.
 *
 * A channel and a set of people are mutually exclusive targets here — you send
 * to one channel, or you open a DM with one or more people — so choosing a
 * channel clears any people and vice versa.
 */
export function NewMessageRecipients({
  people,
  channels,
  selectedPeopleIds,
  onChangePeople,
  selectedChannelId,
  onChangeChannel,
  autoFocus,
  className,
}: NewMessageRecipientsProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const selectedPeople = useMemo(
    () => selectedPeopleIds
      .map((id) => people.find((person) => person.id === id))
      .filter((person): person is RecipientPerson => Boolean(person)),
    [people, selectedPeopleIds],
  );

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    const matchChannel = (channel: RecipientChannel) =>
      !needle ||
      channel.name.toLowerCase().includes(needle) ||
      channel.slug.toLowerCase().includes(needle);
    const matchPerson = (person: RecipientPerson) =>
      !needle ||
      person.name.toLowerCase().includes(needle) ||
      person.handle.toLowerCase().includes(needle) ||
      (person.statusText ?? '').toLowerCase().includes(needle);

    const channelRows: Row[] = channels
      .filter((channel) => channel.id !== selectedChannelId && matchChannel(channel))
      .map((channel) => ({ type: 'channel', channel }));

    const peopleRows: Row[] = people
      .filter(
        (person) => !selectedPeopleIds.includes(person.id) && matchPerson(person),
      )
      // Keep the viewer's own row at the top, as the roster picker did.
      .sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0))
      .map((person) => ({ type: 'person', person }));

    return [...channelRows, ...peopleRows];
  }, [channels, people, query, selectedChannelId, selectedPeopleIds]);

  const clampedActive = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  const commit = (row: Row) => {
    if (row.type === 'channel') {
      onChangePeople([]);
      onChangeChannel(row.channel.id);
    } else {
      onChangeChannel(null);
      onChangePeople([...selectedPeopleIds, row.person.id]);
    }
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeLastToken = () => {
    if (selectedChannel) {
      onChangeChannel(null);
      return;
    }
    if (selectedPeopleIds.length > 0) {
      onChangePeople(selectedPeopleIds.slice(0, -1));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        if (rows.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index + 1) % rows.length);
        break;
      case 'ArrowUp':
        if (rows.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index - 1 + rows.length) % rows.length);
        break;
      case 'Enter':
        if (open && rows[clampedActive]) {
          event.preventDefault();
          commit(rows[clampedActive]);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case 'Backspace':
        if (query.length === 0) removeLastToken();
        break;
      default:
        break;
    }
  };

  const showChannelGroup = rows.some((row) => row.type === 'channel');
  const firstPersonIndex = rows.findIndex((row) => row.type === 'person');
  // Keep the panel up while typing so "no matches" can show; otherwise only
  // when there is something to pick.
  const panelOpen = open && (rows.length > 0 || query.trim().length > 0);

  return (
    <Popover open={panelOpen} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            'gap-1.5 px-2.5 py-2 min-h-11 flex flex-wrap items-center rounded-lg border border-border bg-surface text-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <span className="font-medium pl-0.5 text-muted-foreground select-none">
            To:
          </span>

          {selectedChannel ? (
            <Token
              icon={
                selectedChannel.isPrivate ? (
                  <Lock className="size-3" />
                ) : (
                  <Hash className="size-3" />
                )
              }
              label={selectedChannel.name}
              onRemove={() => onChangeChannel(null)}
            />
          ) : null}

          {selectedPeople.map((person) => (
            <Token
              key={person.id}
              icon={
                <UserAvatar
                  name={person.name}
                  src={person.avatarUrl}
                  seed={person.id}
                  className="size-4"
                />
              }
              label={person.name}
              onRemove={() =>
                onChangePeople(
                  selectedPeopleIds.filter((id) => id !== person.id),
                )
              }
            />
          ))}

          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={panelOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder={
              selectedChannel || selectedPeople.length > 0
                ? 'Add another…'
                : '#a-channel, @somebody, or a name'
            }
            className="min-w-40 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        id={listId}
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-(--radix-popover-trigger-width) max-h-72 p-1"
      >
        {showChannelGroup ? (
          <p className="px-2 pt-1.5 pb-1 font-semibold tracking-wide text-[11px] text-muted-foreground uppercase">
            Channels
          </p>
        ) : null}

        {rows.map((row, index) => {
          const isActive = index === clampedActive;
          const showPeopleHeading = index === firstPersonIndex;

          return (
            <div key={row.type === 'channel' ? `c-${row.channel.id}` : `p-${row.person.id}`}>
              {showPeopleHeading ? (
                <p
                  className={cn(
                    'px-2 pb-1 font-semibold tracking-wide text-[11px] text-muted-foreground uppercase',
                    showChannelGroup ? 'pt-2' : 'pt-1.5',
                  )}
                >
                  People, agents &amp; apps
                </p>
              ) : null}

              <button
                type="button"
                ref={
                  isActive
                    ? (element) => element?.scrollIntoView({ block: 'nearest' })
                    : undefined
                }
                // Keep focus in the input so typing continues after a click.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(row)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'gap-2.5 px-2 py-1.5 flex w-full items-center rounded-md text-left transition-colors',
                  isActive ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                {row.type === 'channel' ? (
                  <>
                    <span className="size-6 flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {row.channel.isPrivate ? (
                        <Lock className="size-3.5" />
                      ) : (
                        <Hash className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {row.channel.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Channel
                    </span>
                  </>
                ) : (
                  <>
                    <UserAvatar
                      name={row.person.name}
                      src={row.person.avatarUrl}
                      seed={row.person.id}
                      presence={toPresenceStatus(row.person.presence)}
                      className={cn(
                        'size-6',
                        row.person.kind === 'agent' && 'ring-2 ring-primary/40',
                        row.person.kind === 'app' &&
                          'ring-2 ring-accent-violet/40',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="gap-1.5 flex items-center">
                        <span className="truncate font-medium">
                          {row.person.name}
                        </span>
                        {row.person.isSelf ? (
                          <span className="font-bold tracking-wider text-[9px] text-muted-foreground uppercase">
                            You
                          </span>
                        ) : row.person.kind === 'agent' ? (
                          <span className="font-bold tracking-wider text-[9px] text-primary uppercase">
                            AI Agent
                          </span>
                        ) : row.person.kind === 'app' ? (
                          <span className="font-bold tracking-wider text-[9px] text-accent-violet uppercase">
                            App
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{row.person.handle}
                        {row.person.statusText ? ` · ${row.person.statusText}` : ''}
                      </span>
                    </span>
                  </>
                )}

                {isActive ? (
                  <kbd className="px-1.5 py-0.5 font-sans text-[10px] rounded border border-border bg-background text-muted-foreground">
                    Enter
                  </kbd>
                ) : null}
              </button>
            </div>
          );
        })}

        {rows.length === 0 ? (
          <p className="gap-2 px-2 py-6 flex items-center justify-center text-xs text-muted-foreground">
            <Search className="size-3.5" />
            No people or channels match “{query}”.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function Token({
  icon,
  label,
  onRemove,
}: {
  icon: ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="gap-1 px-1 py-0.5 max-w-56 inline-flex items-center rounded-md bg-primary/10 text-xs font-medium text-primary">
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="truncate">{label}</span>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="shrink-0 rounded-sm p-0.5 text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
