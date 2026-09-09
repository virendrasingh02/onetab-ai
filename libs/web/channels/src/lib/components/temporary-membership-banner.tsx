import { TEMP_MEMBERSHIP_PRESETS } from '@org/types';
import {
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { formatDateTime, formatRelative } from '@org/utils';
import { Clock } from 'lucide-react';
import { useLeaveChannel, useMembershipMutations } from '../use-channels.js';

export interface TemporaryMembershipBannerProps {
  workspaceId: string | undefined;
  channelId: string;
  currentUserId: string;
  /** ISO string; when the temporary membership lapses. */
  expiresAt: string | null;
}

/**
 * The strip under a channel header when the viewer's own membership is
 * temporary (brief §8): shows when it ends and offers Extend / Make permanent /
 * Leave. Server-side sweep still removes it on time regardless.
 */
export function TemporaryMembershipBanner({
  workspaceId,
  channelId,
  currentUserId,
  expiresAt,
}: TemporaryMembershipBannerProps) {
  const { extend, convertToPermanent } = useMembershipMutations(workspaceId);
  const leave = useLeaveChannel(workspaceId);
  const busy =
    extend.isPending || convertToPermanent.isPending || leave.isPending;

  return (
    <div className="gap-2 px-3 sm:px-6 py-1.5 text-xs flex flex-wrap items-center border-b border-border bg-info/10">
      <Clock className="size-3.5 shrink-0 text-info-text" aria-hidden />
      <span className="text-foreground">
        Temporary membership
        {expiresAt ? (
          <>
            {' — '}
            <Hint label={formatDateTime(expiresAt)}>
              <span className="font-medium">
                expires {formatRelative(expiresAt)}
              </span>
            </Hint>
          </>
        ) : null}
      </span>

      <div className="ml-auto gap-1.5 flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy}>
              Extend
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Extend by
            </DropdownMenuLabel>
            {TEMP_MEMBERSHIP_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.hours}
                className="text-xs"
                onSelect={() =>
                  extend.mutate({ channelId, durationHours: preset.hours })
                }
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => convertToPermanent.mutate(channelId)}
        >
          Make permanent
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void confirm({
              title: 'Leave this channel?',
              description:
                "You'll stop receiving its messages and need a new invite or to rejoin to come back.",
              confirmLabel: 'Leave channel',
              destructive: true,
            }).then((ok) => {
              if (ok) leave.mutate({ channelId, userId: currentUserId });
            });
          }}
        >
          Leave
        </Button>
      </div>
    </div>
  );
}
