import { Button, Hint, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  AIComposer,
  AIErrorRow,
  AIMessage,
  AIThinkingRow,
  useAIConversation,
} from '@org/web-ai';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface AssistantPanelProps {
  onClose: () => void;
  className?: string;
}

/**
 * The shell's right-hand copilot column.
 *
 * Lives here rather than inside `AppShell` so the shell stays a layout concern:
 * previously ~300 lines of chat state and markup sat in the middle of the
 * grid definition, and every keystroke in the composer re-rendered the entire
 * application frame including the router `Outlet`.
 *
 * The conversation, composer and bubbles are the same ones the full-page AI
 * view uses — this file is now only the rail's chrome around them.
 */
export function AssistantPanel({ onClose, className }: AssistantPanelProps) {
  const chat = useAIConversation({ greeting: true });

  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  /*
   * `block: 'nearest'` keeps the scroll inside the message list. The previous
   * `scrollIntoView({ behavior: 'smooth' })` scrolled the nearest scrollable
   * ancestor too, which yanked the main content area on first paint.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chat.messages, chat.isThinking]);

  const reset = () => {
    chat.reset();
    composerRef.current?.focus();
  };

  return (
    /* Surface comes from the host — the rail `aside` on desktop, the sheet on
       mobile — so the panel never paints a second tone over it. */
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="h-12 px-3 flex shrink-0 items-center justify-between border-b border-border">
        {/* Same title treatment as the sheet the panel becomes on mobile. */}
        <span className="gap-1.5 font-semibold text-sm flex items-center text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <span>AI Assistant</span>
        </span>

        <div className="gap-0.5 flex items-center">
          <Hint label="New chat">
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="New chat">
              <RotateCcw className="size-4" />
            </Button>
          </Hint>
          {/* A "Chat history" button sat here with no handler. There is no
              transcript store behind it yet, so it advertised a feature that
              could not be reached — better absent than inert. */}
          <Hint label="Close assistant">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </Button>
          </Hint>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" contentClassName="p-3">
        {/* A hardcoded "Recent chat — Workspace research & step parameters"
            card used to sit here, inside the live transcript and inside the
            `log` region, so screen readers announced it as part of the
            conversation. It was never wired to anything. */}
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
              assistantLabel="Copilot"
              density="compact"
            />
          ))}

          {chat.isThinking ? <AIThinkingRow density="compact" /> : null}

          {chat.isError ? (
            <AIErrorRow
              error={chat.error}
              onRetry={chat.retry}
              density="compact"
            />
          ) : null}

          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="p-3 shrink-0 border-t border-border">
        <AIComposer
          ref={composerRef}
          value={chat.input}
          onValueChange={chat.setInput}
          onSubmit={chat.send}
          model={chat.model}
          onModelChange={chat.setModel}
          isBusy={chat.isThinking}
          variant="docked"
          placeholder="Ask AI anything — @ model, / command…"
        />
      </div>
    </div>
  );
}
