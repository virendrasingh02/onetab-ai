import {
  resolveChannelTabs,
  type ChannelSummary,
  type ChannelTabId,
  type ResolvedChannelTab,
} from '@org/types';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Hint,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  MessageSquare,
  PanelsTopLeft,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSetChannelTabs } from '../use-channels.js';

/** Label and icon for each tab the channel page can show after "Messages". */
export const CHANNEL_TAB_META: Record<
  ChannelTabId,
  { label: string; icon: LucideIcon }
> = {
  'files-media': { label: 'Files & Media', icon: FolderOpen },
  bookmarks: { label: 'Bookmarks', icon: Bookmark },
  pins: { label: 'Pins', icon: Pin },
};

export interface CustomizeChannelTabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
}

/**
 * Reorder and show/hide the channel's tabs, for everyone in it. "Messages"
 * stays first and can't be hidden — it's the channel. Who may open this is
 * the channel's `tabManagePolicy` (Settings → Tabs); the server checks too.
 */
export function CustomizeChannelTabsDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: CustomizeChannelTabsDialogProps) {
  const setTabs = useSetChannelTabs(workspaceId);
  const [rows, setRows] = useState<ResolvedChannelTab[]>(() =>
    resolveChannelTabs(channel.tabOrder, channel.hiddenTabs),
  );

  useEffect(() => {
    if (open) setRows(resolveChannelTabs(channel.tabOrder, channel.hiddenTabs));
  }, [open, channel.tabOrder, channel.hiddenTabs]);

  const move = (index: number, delta: -1 | 1) =>
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const toggle = (id: ChannelTabId) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, hidden: !row.hidden } : row)),
    );

  const save = () => {
    setTabs.mutate({
      channelId: channel.id,
      input: {
        order: rows.map((row) => row.id),
        hidden: rows.filter((row) => row.hidden).map((row) => row.id),
      },
    });
    onOpenChange(false);
  };

  const isDefault =
    JSON.stringify(rows) === JSON.stringify(resolveChannelTabs([], []));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="gap-2 flex items-center">
            <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
              <PanelsTopLeft className="size-4" />
            </div>
            <div>
              <DialogTitle>Customize tabs</DialogTitle>
              <DialogDescription>
                Changes apply to everyone in #{channel.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
            <li className="gap-3 px-3 py-2.5 flex items-center">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">
                Messages
              </span>
              <span className="text-[11px] text-muted-foreground">
                Always first
              </span>
            </li>

            {rows.map((row, index) => {
              const meta = CHANNEL_TAB_META[row.id];
              const Icon = meta.icon;
              return (
                <li key={row.id} className="gap-2 px-3 py-2 flex items-center">
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      row.hidden ? 'text-subtle' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm font-medium',
                      row.hidden ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {meta.label}
                  </span>

                  <div className="flex items-center">
                    <Hint label="Move up">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${meta.label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                    </Hint>
                    <Hint label="Move down">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${meta.label} down`}
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </Hint>
                  </div>

                  <Switch
                    checked={!row.hidden}
                    onCheckedChange={() => toggle(row.id)}
                    aria-label={`Show ${meta.label} tab`}
                  />
                </li>
              );
            })}
          </ul>
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isDefault}
            onClick={() => setRows(resolveChannelTabs([], []))}
          >
            Reset to default
          </Button>
          <div className="gap-2 flex">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
