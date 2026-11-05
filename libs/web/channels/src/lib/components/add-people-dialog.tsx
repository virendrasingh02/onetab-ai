import {
  agentsApi,
  channelAgentsApi,
  invitationApi,
  memberApi,
  queryKeys,
} from '@org/api-client';
import {
  WorkspaceRole,
  type ChannelSummary,
  type PublicUser,
} from '@org/types';
import {
  AiEntityAvatar,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ScrollArea,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, parseEmails } from '@org/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hash, Lock, Mail, Search, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { useChannelAgents } from '../use-channel-agents.js';
import { useChannelMemberMutations } from '../use-channels.js';

export interface AddPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
  /** Ids already in the channel; they are shown as joined rather than offered. */
  existingMemberIds: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One person, agent or email address the dialog can add. */
interface Choice {
  key: string;
  kind: 'person' | 'agent' | 'email';
  /** User id, agent id or email address, by `kind`. */
  id: string;
  label: string;
  detail?: string;
  /** Lowercased text the search box matches against. */
  searchText: string;
  avatarUrl?: string | null;
  user?: PublicUser;
}

const emailChoice = (email: string): Choice => ({
  key: `email:${email}`,
  kind: 'email',
  id: email,
  label: email,
  searchText: email,
});

function ChoiceAvatar({
  choice,
  size,
}: {
  choice: Choice;
  size: 'xs' | 'sm';
}) {
  if (choice.kind === 'email') {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-md bg-surface-inset text-muted-foreground',
          size === 'xs' ? 'size-5' : 'size-7',
        )}
      >
        <Mail aria-hidden className={size === 'xs' ? 'size-3' : 'size-4'} />
      </span>
    );
  }
  if (choice.kind === 'agent') {
    return (
      <AiEntityAvatar
        name={choice.label}
        kind="agent"
        avatarUrl={choice.avatarUrl}
        size={size}
        className={cn('shrink-0', size === 'xs' && 'size-5')}
      />
    );
  }
  return (
    <UserAvatar
      name={choice.label}
      src={choice.avatarUrl}
      seed={choice.id}
      size={size}
      presence={size === 'sm' ? choice.user?.presence : undefined}
      indicator={size === 'sm'}
      className="shrink-0"
    />
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p
      role="presentation"
      className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground first:pt-1"
    >
      {children}
    </p>
  );
}

/** "Ada", "Ada and Ben", or "3 people" — whichever reads best in a toast. */
function describeAdded(picks: Choice[]): string {
  const [first, second] = picks;
  if (picks.length === 1 && first) return first.label;
  if (picks.length === 2 && first && second) {
    return `${first.label} and ${second.label}`;
  }
  const noun = picks.every((p) => p.kind === 'agent') ? 'agents' : 'people';
  return `${picks.length} ${noun}`;
}

/**
 * Adds workspace members and AI agents to a channel, and invites anyone else by
 * email.
 *
 * Everyone is listed up front so nobody has to guess a name. People and agents
 * already in the channel stay listed, greyed out and unselectable — hiding them
 * makes a short list look wrong ("where is everyone?") and invites the same
 * person to be added twice.
 */
export function AddPeopleDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
  existingMemberIds,
}: AddPeopleDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Choice[]>([]);
  /* Index into `options`; -1 until the keyboard or a search picks a row. */
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const queryClient = useQueryClient();
  const { add } = useChannelMemberMutations(workspaceId);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: open && !!workspaceId,
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(workspaceId ?? ''),
    queryFn: () => agentsApi.list(workspaceId as string),
    enabled: open && !!workspaceId,
  });
  // The dialog stays mounted while closed, so only ask once it opens.
  const channelAgents = useChannelAgents(
    open ? workspaceId : undefined,
    channel.id,
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected([]);
      setActiveIndex(-1);
    }
  }, [open]);

  const selectedKeys = useMemo(
    () => new Set(selected.map((choice) => choice.key)),
    [selected],
  );

  const people = useMemo<Choice[]>(
    () =>
      (membersQuery.data ?? []).map((member) => {
        const { user } = member;
        const label = user.displayName ?? user.name;
        return {
          key: `person:${user.id}`,
          kind: 'person',
          id: user.id,
          label,
          detail: user.username
            ? `@${user.username}`
            : (user.jobTitle ?? undefined),
          searchText: [label, user.name, user.username, member.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          avatarUrl: user.avatarUrl,
          user,
        };
      }),
    [membersQuery.data],
  );

  const agents = useMemo<Choice[]>(
    () =>
      (agentsQuery.data ?? []).map((agent) => ({
        key: `agent:${agent.id}`,
        kind: 'agent',
        id: agent.id,
        label: agent.name,
        // Some agents carry their name as their role; don't say it twice.
        detail: agent.role === agent.name ? undefined : agent.role,
        searchText: `${agent.name} ${agent.role}`.toLowerCase(),
        avatarUrl: agent.avatarUrl,
      })),
    [agentsQuery.data],
  );

  const joinedKeys = useMemo(() => {
    const keys = new Set(existingMemberIds.map((id) => `person:${id}`));
    for (const link of channelAgents.data ?? []) {
      // A disabled link can be turned back on by adding the agent again.
      if (link.isEnabled) keys.add(`agent:${link.agentId}`);
    }
    return keys;
  }, [existingMemberIds, channelAgents.data]);

  const needle = search.trim().toLowerCase();
  const matches = (choice: Choice) =>
    !needle || choice.searchText.includes(needle);

  const peopleOptions = people.filter(
    (c) => !joinedKeys.has(c.key) && matches(c),
  );
  // Held back until the channel's links load, so joined agents never flash as
  // addable.
  const agentOptions = channelAgents.isLoading
    ? []
    : agents.filter((c) => !joinedKeys.has(c.key) && matches(c));
  const joined = [...people, ...agents].filter(
    (c) => joinedKeys.has(c.key) && matches(c),
  );

  /* Typed addresses nobody here owns yet: those are the ones to invite. */
  const typedEmails = useMemo(() => {
    const parsed = parseEmails(search);
    if (parsed.length === 0 || !parsed.every((e) => EMAIL_RE.test(e))) {
      return [];
    }
    const known = new Set(
      (membersQuery.data ?? []).flatMap((m) =>
        m.email ? [m.email.toLowerCase()] : [],
      ),
    );
    return parsed.filter(
      (email) => !known.has(email) && !selectedKeys.has(`email:${email}`),
    );
  }, [search, membersQuery.data, selectedKeys]);

  const inviteOption: Choice | null =
    typedEmails.length > 0
      ? {
          ...emailChoice(typedEmails[0] as string),
          key: 'invite',
          label:
            typedEmails.length === 1
              ? `Invite ${typedEmails[0]}`
              : `Invite ${typedEmails.length} people`,
          detail: 'Sends an email with a link to join',
        }
      : null;

  const options = [
    ...(inviteOption ? [inviteOption] : []),
    ...peopleOptions,
    ...agentOptions,
  ];
  const activeOption = options[activeIndex];
  const optionId = (index: number) => `${listId}-option-${index}`;

  const resetSearch = () => {
    setSearch('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const addEmails = (emails: string[]) => {
    setSelected((prev) => [...prev, ...emails.map(emailChoice)]);
    resetSearch();
  };

  const toggle = (choice: Choice) => {
    if (choice.key === 'invite') {
      addEmails(typedEmails);
      return;
    }
    setSelected((prev) =>
      prev.some((c) => c.key === choice.key)
        ? prev.filter((c) => c.key !== choice.key)
        : [...prev, choice],
    );
    resetSearch();
  };

  const remove = (key: string) => {
    setSelected((prev) => prev.filter((c) => c.key !== key));
    inputRef.current?.focus();
  };

  const moveActive = (next: number) => {
    setActiveIndex(next);
    listRef.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  /* An address still in the box counts, so nobody has to press Enter twice. */
  const picks = [...selected, ...typedEmails.map(emailChoice)];
  const emailCount = picks.filter((c) => c.kind === 'email').length;
  const onlyEmails = picks.length > 0 && emailCount === picks.length;
  const canSubmit = picks.length > 0 && !isSubmitting;

  const submit = async () => {
    if (!canSubmit || !workspaceId) return;

    const users = picks.filter((c) => c.kind === 'person');
    const emails = picks.filter((c) => c.kind === 'email');
    const agentPicks = picks.filter((c) => c.kind === 'agent');

    setIsSubmitting(true);

    // Settled separately: one refusal must not lose or repeat the others.
    const [usersResult, emailsResult, ...agentResults] =
      await Promise.allSettled([
        users.length > 0
          ? add.mutateAsync({
              channelId: channel.id,
              input: { userIds: users.map((c) => c.id), role: 'MEMBER' },
            })
          : null,
        emails.length > 0
          ? invitationApi.create(workspaceId, {
              emails: emails.map((c) => c.id),
              role: WorkspaceRole.MEMBER,
              channelId: channel.id,
            })
          : null,
        ...agentPicks.map((c) =>
          channelAgentsApi.add(workspaceId, channel.id, c.id),
        ),
      ]);

    setIsSubmitting(false);

    if (agentPicks.length > 0) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.agents(workspaceId, channel.id),
      });
    }

    const failed: Choice[] = [];
    const added: Choice[] = [];
    let error: unknown;
    const settle = (result: PromiseSettledResult<unknown>, group: Choice[]) => {
      if (result.status === 'rejected') {
        failed.push(...group);
        error ??= result.reason;
      } else {
        added.push(...group);
      }
    };
    settle(usersResult, users);
    agentPicks.forEach((choice, index) => {
      settle(agentResults[index] as PromiseSettledResult<unknown>, [choice]);
    });

    let invitedCount = 0;
    let alreadyMembers: string[] = [];
    if (emailsResult.status === 'rejected') {
      failed.push(...emails);
      error ??= emailsResult.reason;
    } else if (emailsResult.value) {
      const batch = emailsResult.value;
      invitedCount = batch.invited.length;
      alreadyMembers = batch.alreadyMembers;
      const alreadyInvited = batch.alreadyInvited ?? [];
      if (alreadyInvited.length > 0) {
        toast.info(
          alreadyInvited.length === 1
            ? `${alreadyInvited[0]} already has a pending invite`
            : `${alreadyInvited.length} people already have a pending invite`,
        );
      }
    }

    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`Added ${describeAdded(added)} to #${channel.name}`);
    }
    if (invitedCount > 0) {
      parts.push(
        invitedCount === 1 ? 'Invitation sent' : `${invitedCount} invitations sent`,
      );
    }
    if (parts.length > 0) toast.success(parts.join(' · '));

    if (alreadyMembers.length > 0) {
      toast.info(
        alreadyMembers.length === 1
          ? `${alreadyMembers[0]} is already in this workspace. Search their name to add them.`
          : `${alreadyMembers.length} people are already in this workspace. Search their names to add them.`,
      );
    }
    if (failed.length > 0) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Could not add everyone to this channel',
      );
    }

    // Keep what still needs attention on screen, ready to retry or fix.
    if (failed.length > 0 || alreadyMembers.length > 0) {
      setSelected(failed);
      resetSearch();
      return;
    }
    onOpenChange(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (event.metaKey || event.ctrlKey) {
          void submit();
        } else if (activeOption) {
          toggle(activeOption);
        } else if (typedEmails.length > 0) {
          addEmails(typedEmails);
        } else if (!needle) {
          void submit();
        }
        break;
      case ',':
      case ';':
      case ' ':
        if (typedEmails.length > 0) {
          event.preventDefault();
          addEmails(typedEmails);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (options.length > 0) {
          moveActive(Math.min(activeIndex + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (options.length > 0) moveActive(Math.max(activeIndex - 1, 0));
        break;
      case 'Backspace':
        if (!search) setSelected((prev) => prev.slice(0, -1));
        break;
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = parseEmails(event.clipboardData.getData('text'));
    if (pasted.length < 2 || !pasted.every((e) => EMAIL_RE.test(e))) return;
    event.preventDefault();
    addEmails([...new Set(pasted)].filter((e) => !selectedKeys.has(`email:${e}`)));
  };

  const renderOption = (choice: Choice) => {
    const index = options.indexOf(choice);
    const isSelected = selectedKeys.has(choice.key);
    return (
      <button
        key={choice.key}
        id={optionId(index)}
        data-index={index}
        type="button"
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggle(choice)}
        onMouseMove={() => setActiveIndex(index)}
        className={cn(
          'px-2 py-1.5 gap-2.5 flex w-full cursor-pointer items-center rounded-lg text-left transition-colors',
          index === activeIndex && 'bg-accent',
        )}
      >
        <ChoiceAvatar choice={choice} size="sm" />
        <span className="gap-2 min-w-0 flex flex-1 items-baseline">
          <span className="text-sm font-medium truncate text-foreground">
            {choice.label}
          </span>
          {choice.detail ? (
            <span className="text-xs truncate text-muted-foreground">
              {choice.detail}
            </span>
          ) : null}
        </span>
        {isSelected ? (
          <Check aria-hidden className="size-4 shrink-0 text-primary" />
        ) : null}
      </button>
    );
  };

  const isLoading = membersQuery.isLoading || agentsQuery.isLoading;
  const isEmpty = options.length === 0 && joined.length === 0;
  const ChannelIcon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        mobile="sheet"
        className="sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          // First Escape clears the search; the next one closes the dialog.
          // Radix listens on the document, so this is the only place to stop it.
          if (search) {
            event.preventDefault();
            resetSearch();
          }
        }}
      >
        <div className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-lg leading-snug">
            Add people or agents to{' '}
            <span className="whitespace-nowrap">
              <ChannelIcon
                aria-hidden
                className="size-4 mr-0.5 inline-block align-[-2px] text-muted-foreground"
              />
              {channel.name}
            </span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Pick teammates and agents, or type an email to invite someone.
          </DialogDescription>
        </div>

        <div className="px-6">
          <div
            onClick={() => inputRef.current?.focus()}
            className={cn(
              'px-2.5 py-1.5 gap-1.5 min-h-10 max-h-28 flex w-full cursor-text flex-wrap items-center overflow-y-auto',
              'rounded-input border border-input theme-fixed bg-field transition-[border-color,box-shadow] duration-(--duration-fast)',
              'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
            )}
          >
            {selected.length === 0 ? (
              <Search
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            ) : null}

            {selected.map((choice) => (
              <span
                key={choice.key}
                className="h-7 pl-1 pr-0.5 gap-1.5 text-xs font-medium flex max-w-full items-center rounded-md border border-border bg-surface-inset text-foreground select-none"
              >
                <ChoiceAvatar choice={choice} size="xs" />
                <span className="max-w-40 truncate">{choice.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${choice.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(choice.key);
                  }}
                  className="size-5 grid shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:outline-none"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            ))}

            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Search people and agents, or enter an email"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={
                activeOption ? optionId(activeIndex) : undefined
              }
              autoComplete="off"
              autoFocus
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(event.target.value.trim() ? 0 : -1);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                selected.length === 0
                  ? 'Search by name, or enter an email'
                  : 'Add more…'
              }
              className="text-sm h-7 min-w-32 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <ScrollArea className="mt-2 h-72 max-h-[45dvh]" contentClassName="px-4">
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label="People and agents"
            className="pb-1"
          >
            {inviteOption ? renderOption(inviteOption) : null}

            {peopleOptions.length > 0 ? (
              <>
                <GroupLabel>People</GroupLabel>
                {peopleOptions.map(renderOption)}
              </>
            ) : null}

            {agentOptions.length > 0 ? (
              <>
                <GroupLabel>Agents</GroupLabel>
                {agentOptions.map(renderOption)}
              </>
            ) : null}

            {joined.length > 0 ? (
              <>
                <GroupLabel>{`Already in ${channel.name}`}</GroupLabel>
                {joined.map((choice) => (
                  <div
                    key={choice.key}
                    role="option"
                    aria-selected={false}
                    aria-disabled
                    className="px-2 py-1.5 gap-2.5 flex items-center rounded-lg opacity-60"
                  >
                    <ChoiceAvatar choice={choice} size="sm" />
                    <span className="text-sm min-w-0 flex-1 truncate text-foreground">
                      {choice.label}
                    </span>
                    <span className="text-xs shrink-0 text-muted-foreground">
                      Joined
                    </span>
                  </div>
                ))}
              </>
            ) : null}

            {isEmpty ? (
              <div className="px-6 py-10 text-center">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : membersQuery.isError ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Couldn&apos;t load your teammates.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void membersQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </>
                ) : needle ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      No one matches “{search.trim()}”
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter their full email address to invite them.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nobody else to add yet. Enter an email to invite someone.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 gap-3 flex items-center justify-end border-t border-border">
          {emailCount > 0 ? (
            <p className="text-xs min-w-0 mr-auto text-muted-foreground">
              {emailCount === 1 ? 'Invitee joins' : 'Invitees join'} the
              workspace as a member.
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className="shrink-0"
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={() => void submit()}
          >
            {onlyEmails
              ? emailCount > 1
                ? `Send ${emailCount} invites`
                : 'Send invite'
              : picks.length > 1
                ? `Add ${picks.length}`
                : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
