import { useCurrentUser } from '@org/auth';
import { Composer } from '@org/chat-ui';
import { Button, Hint } from '@org/ui';
import { cn } from '@org/utils';
import {
  AI_MODELS,
  AI_STUDIO_SLASH_COMMANDS,
  AIErrorRow,
  AIMessage,
  AIModelPicker,
  AIThinkingRow,
} from '@org/web-ai';
import { useAssistantConversation } from '@org/web-coworkers';
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
  const chat = useAssistantConversation({ greeting: true });
  const user = useCurrentUser();
  const activeOption = AI_MODELS.find((opt) => opt.value === chat.model);
  const sender = {
    id: user?.id,
    name: user?.displayName ?? user?.name,
    avatarUrl: user?.avatarUrl,
  };

  const endRef = useRef<HTMLDivElement>(null);

  /*
   * `block: 'nearest'` keeps the scroll inside the message list. The previous
   * `scrollIntoView({ behavior: 'smooth' })` scrolled the nearest scrollable
   * ancestor too, which yanked the main content area on first paint.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chat.messages, chat.isThinking]);

  return (
    /* Surface comes from the host — the rail `aside` on desktop, the sheet on
       mobile — so the panel never paints a second tone over it. */
    <div className={cn('min-h-0 flex h-full flex-col', className)}>
      <div className="h-12 px-3 flex shrink-0 items-center justify-between border-b border-border">
        {/* Same title treatment as the sheet the panel becomes on mobile. */}
        <span className="gap-1.5 font-semibold text-sm flex items-center text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <span>AI Assistant</span>
        </span>

        <div className="gap-0.5 flex items-center">
          <Hint label="New chat">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={chat.reset}
              aria-label="New chat"
            >
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {/* A hardcoded "Recent chat — Workspace research & step parameters"
            card used to sit here, inside the live transcript and inside the
            `log` region, so screen readers announced it as part of the
            conversation. It was never wired to anything. */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="space-y-4"
        >
          {chat.messages.map((message) => (
            <AIMessage
              key={message.id}
              message={message}
              assistantLabel="Copilot"
              modelId={
                activeOption?.model ||
                (chat.model === 'auto' ? 'nemotron' : chat.model)
              }
              provider={activeOption?.provider}
              user={sender}
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
      </div>

      {/* No divider: the composer card is its own boundary. Tight side/bottom
          gutters so the card sits close to the rail edges. */}
      <div className="px-2 pb-2 shrink-0">
        <Composer
          key={`ai-assistant-panel-${chat.resetToken}`}
          conversationId="ai-assistant-panel"
          surfaceKind="ai-chat"
          onSend={(body) => chat.send(body)}
          disabled={chat.isThinking}
          slashCommands={AI_STUDIO_SLASH_COMMANDS}
          toolbarSlot={
            <AIModelPicker model={chat.model} onModelChange={chat.setModel} />
          }
          placeholder="Ask AI anything…"
        />
      </div>
    </div>
  );
}
