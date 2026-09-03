import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@org/ui';
import { Bookmark, Link2 } from 'lucide-react';
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';

const EMOJI_PRESETS = ['📌', '🔗', '📄', '🎨', '📊', '🚀', '💡', '📁', '✨', '⚡'];

export interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (bookmark: { label: string; href: string; emoji?: string }) => void;
  channelName?: string;
  /**
   * Overrides the default channel-scoped description. Supplied by direct
   * messages, where "#channel" wording does not fit.
   */
  description?: ReactNode;
}

export function AddBookmarkDialog({
  open,
  onOpenChange,
  onAdd,
  channelName,
  description,
}: AddBookmarkDialogProps) {
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [emoji, setEmoji] = useState('🔗');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmedLabel = label.trim();
      let trimmedHref = href.trim();

      if (!trimmedLabel || !trimmedHref) return;

      // Automatically add https:// if missing
      if (!/^https?:\/\//i.test(trimmedHref)) {
        trimmedHref = `https://${trimmedHref}`;
      }

      onAdd({
        label: trimmedLabel,
        href: trimmedHref,
        emoji: emoji.trim() || undefined,
      });

      setLabel('');
      setHref('');
      setEmoji('🔗');
      onOpenChange(false);
    },
    [label, href, emoji, onAdd, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <Bookmark className="size-4" />
              </div>
              <div>
                <DialogTitle>Add bookmark</DialogTitle>
                <DialogDescription>
                  {description ??
                    (channelName
                      ? `Pin a useful link or resource to #${channelName}.`
                      : 'Pin a useful link or resource to this channel.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {/* Title / Label */}
            <div className="space-y-1.5">
              <label
                htmlFor="bookmark-label"
                className="text-xs font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="bookmark-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Project Roadmap, Figma Specs"
                autoFocus
                required
              />
            </div>

            {/* Link / URL */}
            <div className="space-y-1.5">
              <label
                htmlFor="bookmark-href"
                className="text-xs font-medium text-foreground"
              >
                Link URL
              </label>
              <div className="relative">
                <Input
                  id="bookmark-href"
                  type="url"
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="https://..."
                  className="pl-8"
                  required
                />
                <Link2 className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* Icon / Emoji Preset */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Icon
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {EMOJI_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEmoji(preset)}
                    className={`flex size-8 items-center justify-center rounded-md border text-sm transition-all duration-fast ${
                      emoji === preset
                        ? 'border-primary bg-primary/10 text-primary-foreground font-semibold shadow-xs ring-1 ring-primary'
                        : 'border-border bg-surface hover:bg-surface-raised hover:border-border-strong text-foreground'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
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
            <Button
              type="submit"
              disabled={!label.trim() || !href.trim()}
            >
              Add bookmark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
