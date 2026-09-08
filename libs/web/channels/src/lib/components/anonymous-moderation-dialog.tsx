import type { AnonymousRevealResult } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  UserAvatar,
  usePromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { formatRelative } from '@org/utils';
import { Eye, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  useAnonymousMessagingMutations,
  useAnonymousModeration,
} from '../use-channels.js';

export interface AnonymousModerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channelId: string;
}

const KIND_LABEL: Record<string, string> = {
  REPORT: 'Reported',
  REVEAL_AUTHOR: 'Author revealed',
  REMOVE_MESSAGE: 'Message removed',
};

/**
 * Anonymous-message moderation (brief §2). Every "Reveal author" is audited
 * server-side and shows in the Activity tab. Gated behind `moderate_anonymous`
 * — the host only mounts this for a caller that holds it.
 */
export function AnonymousModerationDialog({
  open,
  onOpenChange,
  workspaceId,
  channelId,
}: AnonymousModerationDialogProps) {
  const [tab, setTab] = useState<'messages' | 'activity'>('messages');
  const { list, audit } = useAnonymousModeration(
    workspaceId,
    channelId,
    open,
  );
  const { reveal, remove } = useAnonymousMessagingMutations(
    workspaceId,
    channelId,
  );
  const prompts = usePromptDialog();
  const [revealed, setRevealed] = useState<
    Record<string, AnonymousRevealResult['author']>
  >({});

  const doReveal = async (id: string) => {
    const confirmed = await prompts.confirmAction({
      title: 'Reveal the author?',
      description:
        'This is recorded in the moderation log. Only do it where legally appropriate.',
      confirmLabel: 'Reveal',
      destructive: true,
    });
    if (!confirmed) return;
    const res = await reveal.mutateAsync(id);
    setRevealed((r) => ({ ...r, [id]: res.author }));
  };

  const doRemove = async (id: string) => {
    const reason = await prompts.promptText({
      title: 'Remove this anonymous message',
      label: 'Reason (optional)',
      confirmLabel: 'Remove',
    });
    if (reason === null) return;
    await remove.mutateAsync({ id, reason: reason || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pt-5 pb-3">
          <DialogTitle className="gap-2 flex items-center text-base font-semibold">
            <ShieldAlert className="size-4.5 text-primary" />
            Anonymous moderation
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Review reported anonymous messages. Revealing an author is logged.
          </DialogDescription>
          <div className="mt-2 flex gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
            {(['messages', 'activity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors',
                  tab === t
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] flex-1 p-4">
          {tab === 'messages' ? (
            list.isLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Loading…
              </p>
            ) : (list.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No anonymous messages in this channel.
              </p>
            ) : (
              <ul className="space-y-2">
                {(list.data ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border bg-surface p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {row.matrixEventId.slice(0, 12)}…
                      </span>
                      {row.isReply && (
                        <Badge variant="neutral" className="h-4 px-1 text-[9px]">
                          reply
                        </Badge>
                      )}
                      {row.reportCount > 0 && (
                        <Badge variant="warning" className="h-4 px-1 text-[9px]">
                          {row.reportCount} report
                          {row.reportCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {row.removedAt && (
                        <Badge
                          variant="destructive"
                          className="h-4 px-1 text-[9px]"
                        >
                          removed
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {formatRelative(row.createdAt)}
                      </span>
                    </div>
                    {row.lastReportReason && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        “{row.lastReportReason}”
                      </p>
                    )}
                    {revealed[row.id] && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        <UserAvatar
                          name={
                            revealed[row.id].displayName ??
                            revealed[row.id].name
                          }
                          src={revealed[row.id].avatarUrl ?? undefined}
                          seed={revealed[row.id].id}
                          size="xs"
                          indicator={false}
                        />
                        <span className="font-medium text-foreground">
                          {revealed[row.id].displayName ??
                            revealed[row.id].name}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex justify-end gap-1.5">
                      {!revealed[row.id] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => doReveal(row.id)}
                          disabled={reveal.isPending}
                          className="h-7 gap-1 text-[11px]"
                        >
                          <Eye className="size-3" />
                          Reveal author
                        </Button>
                      )}
                      {!row.removedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => doRemove(row.id)}
                          disabled={remove.isPending}
                          className="h-7 gap-1 text-[11px] text-destructive"
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (audit.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No moderation activity yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(audit.data ?? []).map((event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px]"
                >
                  <UserAvatar
                    name={event.actor.displayName ?? event.actor.name}
                    src={event.actor.avatarUrl ?? undefined}
                    seed={event.actor.id}
                    size="xs"
                    indicator={false}
                  />
                  <span className="text-foreground">
                    {event.actor.displayName ?? event.actor.name}
                  </span>
                  <span className="text-muted-foreground">
                    {KIND_LABEL[event.kind] ?? event.kind}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {formatRelative(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {prompts.dialog}
      </DialogContent>
    </Dialog>
  );
}
