import { memberApi, queryKeys } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Textarea,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import { Check, PenLine, Search, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  useChannelMemberMutations,
  useUpdateChannel,
} from '../use-channels.js';

export interface AddPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
  /** Ids already in the channel; they are shown as joined rather than offered. */
  existingMemberIds: string[];
}

/**
 * Adds workspace members to a channel.
 *
 * People already in the channel stay listed, greyed out and unselectable —
 * hiding them makes a short list look wrong ("where is everyone?") and invites
 * the same person to be invited twice.
 */
export function AddPeopleDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
  existingMemberIds,
}: AddPeopleDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const { add } = useChannelMemberMutations(workspaceId);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: open && !!workspaceId,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected([]);
    }
  }, [open]);

  const alreadyIn = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds],
  );

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((member) => {
      if (!needle) return true;
      const name = member.user.displayName ?? member.user.name;
      return (
        name.toLowerCase().includes(needle) ||
        member.user.name.toLowerCase().includes(needle)
      );
    });
  }, [membersQuery.data, search]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;

    add.mutate(
      {
        channelId: channel.id,
        input: { userIds: selected, role: 'MEMBER' },
      },
      {
        onSuccess: () => {
          toast.success(
            selected.length === 1
              ? 'Added 1 person to the channel'
              : `Added ${selected.length} people to the channel`,
          );
          onOpenChange(false);
        },
        onError: () => toast.error('Could not add people to this channel'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <UserPlus className="size-4" />
              </div>
              <div>
                <DialogTitle>Add people</DialogTitle>
                <DialogDescription>
                  Invite workspace members to #{channel.name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-6 py-4">
            <div className="relative">
              <Search className="top-2.5 left-2.5 size-3.5 absolute text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name…"
                aria-label="Search workspace members"
                className="pl-8"
                autoFocus
              />
            </div>

            <ScrollArea
              className="max-h-64"
              contentClassName="space-y-0.5 pr-1"
            >
              {membersQuery.isLoading ? (
                <p className="py-6 text-xs text-center text-muted-foreground">
                  Loading members…
                </p>
              ) : candidates.length === 0 ? (
                <p className="py-6 text-xs text-center text-muted-foreground">
                  No workspace members match that search.
                </p>
              ) : (
                candidates.map((member) => {
                  const name = member.user.displayName ?? member.user.name;
                  const joined = alreadyIn.has(member.user.id);
                  const isSelected = selected.includes(member.user.id);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      disabled={joined}
                      onClick={() =>
                        setSelected((current) =>
                          current.includes(member.user.id)
                            ? current.filter((id) => id !== member.user.id)
                            : [...current, member.user.id],
                        )
                      }
                      className={cn(
                        'gap-2.5 px-2 py-1.5 flex w-full items-center rounded-lg text-left transition-colors',
                        joined
                          ? 'opacity-50'
                          : isSelected
                            ? 'bg-primary/15'
                            : 'hover:bg-accent/60',
                      )}
                    >
                      <UserAvatar
                        name={name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-semibold block truncate text-foreground">
                          {name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          @{member.user.name}
                        </span>
                      </span>
                      {joined ? (
                        <span className="tracking-wide text-[10px] text-muted-foreground uppercase">
                          In channel
                        </span>
                      ) : isSelected ? (
                        <Check className="size-4 text-primary-text" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selected.length === 0 || add.isPending}
            >
              {selected.length > 0 ? `Add ${selected.length}` : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface EditChannelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
}

/** Edits the one-line topic and the longer description together. */
export function EditChannelDetailsDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: EditChannelDetailsDialogProps) {
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [description, setDescription] = useState(channel.description ?? '');
  const update = useUpdateChannel(workspaceId);

  // Reopening after someone else edited the channel should show their text,
  // not the stale copy this dialog started with.
  useEffect(() => {
    if (open) {
      setTopic(channel.topic ?? '');
      setDescription(channel.description ?? '');
    }
  }, [open, channel.topic, channel.description]);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    update.mutate(
      {
        channelId: channel.id,
        input: {
          topic: topic.trim() || null,
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Channel details updated');
          onOpenChange(false);
        },
        onError: () => toast.error('Could not update this channel'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <PenLine className="size-4" />
              </div>
              <div>
                <DialogTitle>Channel details</DialogTitle>
                <DialogDescription>
                  Tell people what #{channel.name} is for.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1.5">
              <label
                htmlFor="channel-topic"
                className="text-xs font-medium text-foreground"
              >
                Topic
              </label>
              <Input
                id="channel-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="A short line shown next to the channel name"
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="channel-description"
                className="text-xs font-medium text-foreground"
              >
                Description
              </label>
              <Textarea
                id="channel-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this channel is for, who belongs here, and what to post."
                maxLength={500}
                rows={4}
              />
              <p className="text-[11px] text-muted-foreground">
                {description.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
