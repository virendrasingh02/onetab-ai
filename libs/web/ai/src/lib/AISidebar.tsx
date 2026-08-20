import {
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@org/ui';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AIComposer } from './ai-composer.js';
import { AIErrorRow, AIMessage, AIThinkingRow } from '@org/chat-ui';
import { useAIConversation } from './use-ai-conversation.js';

export interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The workspace-wide AI copilot, opened from the shell's floating trigger.
 *
 * Built on `Sheet` (Radix Dialog) rather than a bare fixed-position div, so it
 * traps focus, closes on Escape, restores focus to the trigger and is exposed
 * to assistive technology as a dialog.
 *
 * Everything inside the sheet — conversation state, bubbles, composer — is the
 * same set the home view and the docked panel use, so this surface cannot
 * drift away from them again.
 */
export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const chat = useAIConversation({ greeting: true });

  const streamEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages, chat.isThinking]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 sm:max-w-md w-full">
        <SheetHeader className="gap-3 px-4 py-3 flex-row items-center border-b">
          <span
            aria-hidden
            className="size-8 shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-sm">AI Copilot</SheetTitle>
            <SheetDescription className="text-xs">
              Ask about anything in this workspace
            </SheetDescription>
          </div>
        </SheetHeader>

        {/*
          `aria-live="polite"` so replies are announced as they arrive without
          interrupting whatever the user is currently doing.
        */}
        <ScrollArea
          className="min-h-0 flex-1"
          contentClassName="space-y-3 p-4"
          viewportProps={{ 'aria-live': 'polite', 'aria-busy': chat.isThinking }}
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

          <div ref={streamEndRef} />
        </ScrollArea>

        {/*
          The model picker moved out of the header strip and into the composer,
          where every other AI surface keeps it — next to the `@` that can also
          change it mid-sentence.
        */}
        <div className="p-3 shrink-0 border-t border-border">
          <AIComposer
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
      </SheetContent>
    </Sheet>
  );
}
