import { useCurrentUser } from '@org/auth';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  Home,
  Info,
  Moon,
  MoreHorizontal,
  RotateCcw,
  Star,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AIComposer } from './ai-composer.js';
import { AIErrorRow, AIMessage, AIThinkingRow } from '@org/chat-ui';
import { useAIConversation } from './use-ai-conversation.js';

/**
 * Greeting word, icon, and the boundaries between them — all by wall-clock
 * hour, since there's no weather data anywhere in this app to back a real
 * forecast icon.
 */
const DAYPARTS = [
  { untilHour: 5, label: 'Good evening', Icon: Moon },
  { untilHour: 12, label: 'Good morning', Icon: Sunrise },
  { untilHour: 17, label: 'Good afternoon', Icon: Sun },
  { untilHour: 21, label: 'Good evening', Icon: Sunset },
  { untilHour: 24, label: 'Good evening', Icon: Moon },
] as const;

function useDaypartClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // A minute is as fine-grained as the display gets (it shows HH:mm), so
    // there is nothing to gain from ticking more often than that.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const daypart =
    DAYPARTS.find((part) => now.getHours() < part.untilHour) ??
    DAYPARTS[DAYPARTS.length - 1];

  return { now, greeting: daypart.label, Icon: daypart.Icon };
}

/**
 * The full-page AI surface.
 *
 * Shares its composer, transcript and conversation state with the docked
 * assistant panel; the only thing it decides for itself is where the composer
 * sits — centred with the headline while the conversation is empty, docked to
 * the bottom of the column once it is not.
 */
export function AIChatView() {
  const chat = useAIConversation();
  const user = useCurrentUser();
  const { now, greeting, Icon: DaypartIcon } = useDaypartClock();
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  const firstName = (user?.displayName ?? user?.name ?? '').split(' ')[0];

  const streamEndRef = useRef<HTMLDivElement>(null);

  /* `block: 'nearest'` keeps the scroll inside the transcript. Without it the
     nearest scrollable ancestor — the shell's `main` — is dragged along too. */
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [chat.messages, chat.isThinking]);

  const handleCopy = () => {
    const transcript = chat.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(transcript || window.location.href);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast.success(
      !isFavorite ? 'Added to favorites' : 'Removed from favorites',
    );
  };

  const composer = (
    <AIComposer
      value={chat.input}
      onValueChange={chat.setInput}
      onSubmit={chat.send}
      model={chat.model}
      onModelChange={chat.setModel}
      isBusy={chat.isThinking}
      variant={chat.isEmpty ? 'hero' : 'docked'}
      placeholder={
        chat.isEmpty
          ? 'Ask anything — @ for a model, / for a command…'
          : 'Ask a follow-up…'
      }
    />
  );

  return (
    /*
      The shell's page scroller gives its content box `min-h-full`, so a page
      fills the column with `flex-1 min-h-0` — not with a viewport height. The
      old `min-h-[calc(100vh-5rem)]` guessed at the chrome above it (header,
      gutters, notification bar), always guessed low, and pushed the composer
      below the fold instead of pinning it to the bottom of the column.
    */
    <div className="min-h-0 flex w-full flex-1 flex-col items-center text-foreground">
      {chat.isEmpty ? (
        /* Landing: headline and composer centred in the column together. */
        <div className="max-w-2xl gap-6 px-4 animate-in fade-in flex w-full flex-1 flex-col items-center justify-center duration-(--duration-slow)">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p className="gap-1.5 text-sm flex items-center justify-center text-muted-foreground">
              <DaypartIcon className="size-3.5" aria-hidden />
              <span>
                {now.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
                {' · '}
                {now.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </p>
          </div>

          {composer}
        </div>
      ) : (
        <>
          <header className="gap-3 px-4 py-2.5 mb-2 flex w-full shrink-0 items-center justify-between border-b border-border bg-background/95">
            <div className="gap-0.5 min-w-0 flex items-center">
              <span className="size-7 flex shrink-0 items-center justify-center">
                <Home className="size-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-sm truncate">Home</span>
            </div>

            <div className="gap-1 flex items-center">
              {/* 3. 3-dot dropdown menu */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="AI Options"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-60">
                  <DropdownMenuItem
                    onClick={handleCopy}
                    className="justify-between"
                  >
                    <div className="gap-2.5 flex items-center">
                      {copied ? (
                        <Check className="size-4 text-success-text" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span>Copy transcript</span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={chat.reset}
                    className="justify-between"
                  >
                    <div className="gap-2.5 flex items-center">
                      <RotateCcw className="size-4" />
                      <span>Sync &amp; Clear context</span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      toast.info(
                        `Active Model: ${chat.modelLabel} · Context: Workspace Index`,
                      );
                    }}
                    className="gap-2.5"
                  >
                    <Info className="size-4" />
                    <span>Model details</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleToggleFavorite}
                    className="gap-2.5"
                  >
                    <Star
                      className={cn(
                        'size-4',
                        isFavorite && 'fill-current text-accent-amber',
                      )}
                    />
                    <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Native scroll container without SimpleBar */}
          <div className="max-w-3xl min-h-0 w-full flex-1 overflow-y-auto px-4">
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="space-y-3"
            >
              {chat.messages.map((message) => (
                <AIMessage
                  key={message.id}
                  message={message}
                  assistantLabel={`${chat.modelLabel} Copilot`}
                />
              ))}

              {chat.isThinking ? <AIThinkingRow /> : null}

              {chat.isError ? (
                <AIErrorRow error={chat.error} onRetry={chat.retry} />
              ) : null}

              <div ref={streamEndRef} />
            </div>
          </div>

          <div className="max-w-3xl px-4 pt-3 pb-1 w-full shrink-0">
            {composer}
          </div>
        </>
      )}
    </div>
  );
}
