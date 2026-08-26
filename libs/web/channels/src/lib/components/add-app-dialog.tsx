import { useState, useMemo, useEffect } from 'react';
import type { ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Blocks,
  Check,
  Plus,
  Search,
} from 'lucide-react';
import {
  PRESET_CHANNEL_APPS,
  type ChannelConnectedApp,
} from '../types/channel-agents-apps.js';

export interface AddAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
  existingAppSlugs: string[];
  onAddApp: (app: Omit<ChannelConnectedApp, 'addedAt'>) => void;
}

export function AddAppDialog({
  open,
  onOpenChange,
  channel,
  existingAppSlugs,
  onAddApp,
}: AddAppDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedAppId(null);
    }
  }, [open]);

  const existingSet = useMemo(
    () => new Set(existingAppSlugs),
    [existingAppSlugs],
  );

  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return PRESET_CHANNEL_APPS;
    return PRESET_CHANNEL_APPS.filter(
      (app) =>
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query) ||
        app.botHandle.toLowerCase().includes(query),
    );
  }, [search]);

  const handleAdd = () => {
    const app = PRESET_CHANNEL_APPS.find((a) => a.id === selectedAppId);
    if (!app) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onAddApp(app);
      onOpenChange(false);
    }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-accent-violet/30 bg-accent-violet-soft text-accent-violet">
              <Blocks className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Add App to #{channel.name}</span>
                <Badge variant="neutral" className="text-[10px] py-0 h-4 font-mono">
                  Integration
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Connect external apps, issue trackers, and monitoring bots to post live updates.
                {' '}Local preview — only visible to you in this browser, not
                the rest of the channel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 py-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps (GitHub, Linear, Sentry, Figma...)"
              className="pl-9 text-xs"
              autoFocus
            />
          </div>

          <ScrollArea className="h-64 rounded-xl border border-border bg-surface/50 p-2">
            <div className="space-y-2">
              {filteredApps.map((app) => {
                const isAlreadyAdded = existingSet.has(app.slug);
                const isSelected = selectedAppId === app.id;

                return (
                  <button
                    key={app.id}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => setSelectedAppId(app.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer',
                      isAlreadyAdded
                        ? 'opacity-60 cursor-not-allowed bg-muted/30 border-border/50'
                        : isSelected
                          ? 'border-accent-violet bg-accent-violet-soft ring-1 ring-accent-violet'
                          : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised',
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={app.name}
                        seed={app.icon}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {app.name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {app.botHandle}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 h-4 capitalize"
                          >
                            {app.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {app.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {app.events.map((evt) => (
                            <span
                              key={evt}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                            >
                              {evt}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {isAlreadyAdded ? (
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Connected
                        </span>
                      ) : (
                        <div
                          className={cn(
                            'size-5 rounded-full border flex items-center justify-center transition-colors',
                            isSelected
                              ? 'border-accent-violet bg-accent-violet text-white'
                              : 'border-border bg-surface',
                          )}
                        >
                          {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedAppId || isSubmitting}
            loading={isSubmitting}
            onClick={handleAdd}
            className="gap-1.5 bg-accent-violet hover:bg-accent-violet text-white"
          >
            <Plus className="size-3.5" />
            <span>Connect App to Channel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
