import { cn } from '@org/utils';
import { Bookmark } from 'lucide-react';

/**
 * Slack-style "Saved for later" marker — a full-width row above a saved
 * message, shared by `ChatBubble` and the AI agent card so every message kind
 * shows it the same way. The host row must be `flex flex-wrap` (the label takes
 * `basis-full`); an empty spacer matches the avatar gutter so the text lines up
 * with the sender name and nothing sits on top of the avatar.
 */
export function SavedForLaterLabel({
  density = 'comfy',
}: {
  density?: 'comfy' | 'compact';
}) {
  const isCompact = density === 'compact';
  return (
    <div
      className={cn(
        'flex basis-full items-center',
        isCompact ? 'mb-0.5 gap-x-2.5' : 'mb-1 gap-x-4',
      )}
    >
      <span aria-hidden className={cn(isCompact ? 'w-8' : 'w-10', 'shrink-0')} />
      <span className="gap-1 inline-flex items-center text-xs font-semibold text-primary-text">
        <Bookmark className="size-3 shrink-0 fill-current" aria-hidden />
        Saved for later
      </span>
    </div>
  );
}
