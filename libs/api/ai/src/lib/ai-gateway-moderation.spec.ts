import { describe, expect, it, vi } from 'vitest';
import { AIInfrastructureService } from './ai-infrastructure.service.js';

function gateway(adapter: Record<string, unknown>, unsafe = false) {
  const moderation = {
    assertTextAllowed: vi.fn(async () => {
      if (unsafe) throw new Error('blocked');
    }),
    moderateText: vi.fn(async () =>
      unsafe
        ? { allowed: false, scanned: true, category: 'hate' }
        : { allowed: true, scanned: true },
    ),
  };
  const service = new AIInfrastructureService(
    { getAdapter: () => adapter } as never,
    { supports: () => true } as never,
    { resolve: () => ({ provider: 'nvidia', model: 'm' }) } as never,
    {} as never,
    moderation as never,
  );
  return { service, moderation };
}

const reply = (content: string, extra = {}) => ({
  chat: vi.fn(async () => ({
    message: { role: 'assistant', content, ...extra },
  })),
});
const messages = [{ role: 'user', content: 'hello' }] as never;

describe('gateway chat', () => {
  it('checks the prompt before spending a provider call', async () => {
    const adapter = reply('hi');
    const { service } = gateway(adapter, true);

    await expect(service.chat({ messages, moderate: 'all' })).rejects.toThrow(
      'blocked',
    );
    expect(adapter.chat).not.toHaveBeenCalled();
  });

  it('withholds a reply the local filter catches, for every caller', async () => {
    const { service } = gateway(reply('go kill yourself'));

    const result = await service.chat({ messages });

    expect(result.message.content).not.toContain('kill');
    expect(result.finishReason).toBe('content_filter');
  });

  it('asks the safety model only when moderation is on', async () => {
    const { service, moderation } = gateway(reply('fine'));

    await service.chat({ messages });
    expect(moderation.moderateText).not.toHaveBeenCalled();

    await service.chat({ messages, moderate: 'output' });
    expect(moderation.moderateText).toHaveBeenCalledWith('fine');
  });

  it('leaves structured output and tool calls for the caller', async () => {
    const { service } = gateway(reply('{"text":"kill yourself"}'));

    const result = await service.chat({
      messages,
      structuredOutput: {},
    });

    expect(result.message.content).toContain('kill');
  });
});

describe('gateway stream', () => {
  const stream = (...events: unknown[]) => ({
    stream: async function* () {
      yield* events;
    },
  });
  const delta = (content: string) => ({ type: 'content_delta', content });
  const collect = async (generator: AsyncGenerator<unknown>) => {
    const out: Array<{ type: string; content?: string }> = [];
    for await (const event of generator) out.push(event as never);
    return out;
  };

  it('stops before a blocked phrase reaches the reader, across chunks', async () => {
    const { service } = gateway(
      stream(delta('go kill'), delta(' yourself'), delta(' now')),
    );

    const events = await collect(service.streamChat({ messages }));

    expect(events.map((e) => e.type)).toEqual(['content_delta', 'error']);
    expect(JSON.stringify(events)).not.toContain('yourself');
  });

  it('replaces completion with an error when the model flags the reply', async () => {
    const { service } = gateway(
      stream(delta('text'), { type: 'message_complete' }),
      true,
    );
    service['moderation']!.assertTextAllowed = vi.fn(async () => undefined);

    const events = await collect(
      service.streamChat({ messages, moderate: 'all' }),
    );

    expect(events.at(-1)?.type).toBe('error');
  });
});
