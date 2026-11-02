import { cn, parseCommandInvocation, toPlainMessageText } from '@org/utils';
import { Slash } from 'lucide-react';

/**
 * Shared look for a slash-command invocation. The timeline (`MarkdownMessage`)
 * and every one-line preview use these, so `/asana create_task …` reads the
 * same in the channel, threads, pins, the sidebar and search.
 */
export const COMMAND_CHIP_CLASS =
  'rounded-[0.3em] px-[0.3em] py-px box-decoration-clone align-baseline bg-accent-violet-soft font-semibold text-accent-violet';

export const COMMAND_ACTION_CLASS =
  'rounded-[0.3em] border border-border/70 bg-muted/60 px-[0.35em] py-px font-mono text-[0.85em] text-foreground/80 align-baseline';

const ICON_CLASS =
  'mr-[0.2em] inline-block size-[0.9em] -translate-y-px align-middle';

/** `/command` + `action` chips; the caller renders what follows. */
export function CommandChips({
  command,
  action,
}: {
  command: string;
  action?: string;
}) {
  return (
    <>
      <span
        className={COMMAND_CHIP_CLASS}
        data-command={command.toLowerCase()}
        title={`Ran /${command}${action ? ` ${action}` : ''}`}
      >
        <Slash className={ICON_CLASS} aria-hidden />
        {command}
      </span>
      {action ? (
        <>
          {' '}
          <span className={COMMAND_ACTION_CLASS}>{action}</span>
        </>
      ) : null}
    </>
  );
}

/**
 * A message body as one line of preview text — reply quotes, pinned banner,
 * thread lists, saved items. Command invocations get their chips; anything
 * else is the flattened plain text. Truncation/clamping is the caller's.
 */
export function MessagePreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const invocation = parseCommandInvocation(text);
  if (!invocation) {
    return <span className={className}>{toPlainMessageText(text)}</span>;
  }
  const rest = toPlainMessageText(invocation.rest);
  return (
    <span className={cn(className)}>
      <CommandChips command={invocation.command} action={invocation.action} />
      {rest ? ` ${rest}` : null}
    </span>
  );
}
