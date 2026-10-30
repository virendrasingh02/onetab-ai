import type { AIAgentMessageContent } from '@org/types';
import { describe, expect, it, vi } from 'vitest';
import {
  MatrixBotMessagingService,
  fitStructuredEvent,
} from './matrix-bot-messaging.service.js';

const scrape = 'x'.repeat(40_000);

function agentEvent(
  overrides: Partial<AIAgentMessageContent> = {},
): AIAgentMessageContent {
  return {
    type: 'mie.ai.agent',
    agentId: 'agent-1',
    status: 'completed',
    responseText: 'Here are three stakeholder blog post ideas.',
    tools: [
      {
        name: 'firecrawl_search',
        status: 'success',
        input: { q: 'a' },
        output: scrape,
      },
      {
        name: 'firecrawl_search',
        status: 'success',
        input: { q: 'b' },
        output: { pages: [scrape] },
      },
    ],
    ...overrides,
  };
}

const bytes = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

describe('fitStructuredEvent', () => {
  it('leaves a small event untouched', () => {
    const event = agentEvent({ tools: [] });
    expect(fitStructuredEvent(event)).toBe(event);
  });

  it('clips large tool outputs but keeps the answer', () => {
    const fitted = fitStructuredEvent(agentEvent()) as AIAgentMessageContent;
    expect(bytes(fitted)).toBeLessThan(24 * 1024);
    expect(fitted.responseText).toBe(
      'Here are three stakeholder blog post ideas.',
    );
    expect(String(fitted.tools?.[0].output)).toMatch(/… \(truncated\)$/);
    expect(fitted.tools?.map((tool) => tool.name)).toEqual([
      'firecrawl_search',
      'firecrawl_search',
    ]);
  });

  it('shortens the answer only as a last resort', () => {
    const fitted = fitStructuredEvent(
      agentEvent({ responseText: 'y'.repeat(60_000) }),
    ) as AIAgentMessageContent;
    expect(bytes(fitted)).toBeLessThanOrEqual(24 * 1024);
    expect(fitted.responseText).toMatch(/reply shortened to fit\)$/);
  });
});

describe('MatrixBotMessagingService', () => {
  it('sends one copy of the event and keeps edits under the 64 KiB limit', async () => {
    const sendEventAs = vi.fn().mockResolvedValue('$event');
    const service = new MatrixBotMessagingService({ sendEventAs } as never);

    await service.sendStructured('!room', '@bot', agentEvent());
    await service.updateStructured('!room', '@bot', '$event', agentEvent());

    const [sent, edit] = sendEventAs.mock.calls.map((call) => call[3]);
    expect(Object.keys(sent)).toEqual(['msgtype', 'body', 'mie_event']);
    expect(edit.mie_event).toBeUndefined();
    expect(edit['m.new_content'].mie_event.type).toBe('mie.ai.agent');
    expect(bytes(sent)).toBeLessThan(64 * 1024);
    expect(bytes(edit)).toBeLessThan(64 * 1024);
  });
});
