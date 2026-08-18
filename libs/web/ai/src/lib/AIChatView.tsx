import { Badge, Button, ScrollArea } from '@org/ui';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
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

  const streamEndRef = useRef<HTMLDivElement>(null);

  /* `block: 'nearest'` keeps the scroll inside the transcript. Without it the
     nearest scrollable ancestor — the shell's `main` — is dragged along too. */
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.messages, chat.isThinking]);

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
          <header className="max-w-3xl gap-3 px-4 py-2 mb-3 flex w-full shrink-0 items-center justify-between border-b border-border">
            <span className="gap-2 min-w-0 flex items-center">
              <span className="size-7 shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-sm truncate">
                AI Assistant
              </span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {chat.modelLabel}
              </Badge>
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={chat.reset}
              leadingIcon={<RotateCcw className="size-3.5" />}
            >
              New chat
            </Button>
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
