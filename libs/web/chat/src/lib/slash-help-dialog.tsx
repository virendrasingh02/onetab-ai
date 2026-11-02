import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { SLASH_COMMAND_CATEGORIES, type SlashCommand } from '@org/chat-ui';
import { useMemo } from 'react';

interface SlashHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The commands this conversation's `/` menu offers. */
  commands: SlashCommand[];
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['/'], label: 'Open the command menu' },
  { keys: ['@'], label: 'Mention a person, agent or app' },
  { keys: ['#'], label: 'Link a channel' },
  { keys: [':'], label: 'Insert an emoji' },
  { keys: ['Shift', 'Enter'], label: 'New line' },
  { keys: ['Esc'], label: 'Close a menu' },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-foreground/80"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/**
 * What `/help` opens: every command available in this conversation, grouped
 * the same way as the `/` menu, plus the composer's keyboard shortcuts.
 */
export function SlashHelpDialog({ open, onOpenChange, commands }: SlashHelpDialogProps) {
  const groups = useMemo(() => {
    const builtIn = commands.filter((c) => !c.source);
    const out = [...SLASH_COMMAND_CATEGORIES, { id: undefined, label: 'Other' }]
      .map((cat) => ({
        label: cat.label,
        commands: builtIn.filter((c) => c.category === cat.id),
      }))
      .filter((g) => g.commands.length > 0);
    const contributed = commands.filter((c) => c.source);
    for (const c of contributed) {
      const label = c.source?.label ?? 'Apps';
      let group = out.find((g) => g.label === label);
      if (!group) {
        group = { label, commands: [] };
        out.push(group);
      }
      group.commands.push(c);
    }
    return out;
  }, [commands]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobile="full" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Commands &amp; shortcuts</DialogTitle>
          <DialogDescription>
            Type <span className="font-mono">/</span> at the start of a message to run
            one of these here.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
                {group.commands.map((c) => (
                  <li
                    key={`${c.source?.label ?? ''}${c.name}${c.title ?? ''}`}
                    className="px-3 py-2 flex items-baseline gap-3 text-sm"
                  >
                    <span className="w-52 shrink-0 font-medium text-foreground">
                      {c.source ? (c.title ?? c.name) : c.name}
                      {c.args && !c.source ? (
                        <span className="ml-1.5 font-mono text-2xs font-normal text-muted-foreground">
                          {c.args}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {c.description}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section>
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Keyboard
            </h3>
            <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.label}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-foreground/90">{s.label}</span>
                  <Keys keys={s.keys} />
                </li>
              ))}
            </ul>
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
