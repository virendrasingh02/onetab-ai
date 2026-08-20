import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  Headphones,
  Info,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AIComposer } from './ai-composer.js';
import { AIErrorRow, AIMessage, AIThinkingRow } from './ai-message.js';
import { useAIConversation } from './use-ai-conversation.js';

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
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  const streamEndRef = useRef<HTMLDivElement>(null);

  /* `block: 'nearest'` keeps the scroll inside the transcript. Without it the
     nearest scrollable ancestor — the shell's `main` — is dragged along too. */
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.messages, chat.isThinking]);

  const handleCopy = () => {
    const transcript = chat.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(transcript || window.location.href);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast.success(!isFavorite ? 'Added to favorites' : 'Removed from favorites');
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
    <div className="flex min-h-0 w-full flex-1 flex-col items-center text-foreground">
      {chat.isEmpty ? (
        /* Landing: headline and composer centred in the column together. */
        <div className="max-w-2xl gap-6 px-4 animate-in fade-in flex w-full flex-1 flex-col items-center justify-center duration-(--duration-slow)">
          <div className="space-y-2 text-center">
            <span className="size-10 mx-auto flex items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Your AI Copilot
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask about your workspace, or start with{' '}
              <span className="font-mono text-primary">@</span> to pick a model
              and <span className="font-mono text-primary">/</span> for a
              command.
            </p>
          </div>

          {composer}
        </div>
      ) : (
        <>
          <header className="max-w-3xl gap-3 px-4 py-2.5 mb-2 flex w-full shrink-0 items-center justify-between border-b border-border">
            <div className="gap-2 min-w-0 flex items-center">
              <span className="size-7 shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-sm truncate">
                AI Assistant
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* 1. Fav icon */}
              <Hint
                label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={isFavorite}
                  aria-label={
                    isFavorite ? 'Remove from favorites' : 'Add to favorites'
                  }
                  onClick={handleToggleFavorite}
                  className={isFavorite ? 'text-warning' : undefined}
                >
                  <Star
                    className={cn(
                      'size-4',
                      isFavorite && 'fill-current text-accent-amber',
                    )}
                  />
                </Button>
              </Hint>

              {/* 2. Huddle icon */}
              <Hint label="Start a voice huddle with AI">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Start a voice huddle"
                  onClick={() => {
                    toast.info('Starting voice copilot huddle…');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Headphones className="size-4" />
                </Button>
              </Hint>

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
                  <DropdownMenuItem onClick={handleCopy} className="justify-between">
                    <div className="gap-2.5 flex items-center">
                      {copied ? (
                        <Check className="size-4 text-success-text" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span>Copy transcript</span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={chat.reset} className="justify-between">
                    <div className="gap-2.5 flex items-center">
                      <RotateCcw className="size-4" />
                      <span>Sync &amp; Clear context</span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      toast.info(`Active Model: ${chat.modelLabel} · Context: Workspace Index`);
                    }}
                    className="gap-2.5"
                  >
                    <Info className="size-4" />
                    <span>Model details</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleToggleFavorite} className="gap-2.5">
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

          {/* `min-h-0` is what lets the transcript scroll: without it this flex
              child refuses to shrink past its content, the `ScrollArea` never
              gets a bounded height, and the whole page scrolls instead. */}
          <ScrollArea
            className="max-w-3xl min-h-0 w-full flex-1"
            contentClassName="px-4"
          >
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
          </ScrollArea>

          <div className="max-w-3xl px-4 pt-3 pb-1 w-full shrink-0">
            {composer}
          </div>
        </>
      )}
    </div>
  );
}
