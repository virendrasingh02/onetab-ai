import { UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContentModerationService,
  parseGuardReply,
} from './content-moderation.service.js';

function service(env: Record<string, string> = { NVIDIA_API_KEY: 'k' }) {
  return new ContentModerationService({
    get: (key: string) => env[key],
  } as never);
}

function guardSays(reply: string) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: reply } }] }),
      ),
    );
}

const png = () =>
  sharp({
    create: { width: 8, height: 8, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer();

afterEach(() => vi.restoreAllMocks());

describe('parseGuardReply', () => {
  it('reads safe and unsafe answers', () => {
    expect(parseGuardReply('safe')).toBeNull();
    expect(parseGuardReply('unsafe\nS10')).toBe('hate');
    expect(parseGuardReply('unsafe\nS2,S4')).toBe('child_safety');
  });

  it('ignores hazards that are ordinary business talk', () => {
    expect(parseGuardReply('unsafe\nS6')).toBeNull();
    expect(parseGuardReply('unsafe\nS8,S14')).toBeNull();
  });
});

describe('moderateText', () => {
  it('stops listed terms without calling the provider', async () => {
    const fetch = guardSays('safe');
    const verdict = await service().moderateText('kill yourself');
    expect(verdict.allowed).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the model about everything else', async () => {
    guardSays('unsafe\nS11');
    expect(await service().moderateText('subtle text')).toMatchObject({
      allowed: false,
      category: 'self_harm',
    });
  });
});

describe('moderateFile', () => {
  it('sends images to the model as JPEG', async () => {
    const fetch = guardSays('unsafe\nS12');
    const verdict = await service().moderateFile({
      buffer: await png(),
      originalname: 'photo.png',
    });
    expect(verdict.allowed).toBe(false);
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content[0].type).toBe('text');
    expect(body.messages[0].content[1].image_url.url).toMatch(
      /^data:image\/jpeg;base64,/,
    );
  });

  it('judges the bytes, not the claimed name or type', async () => {
    guardSays('unsafe\nS12');
    const verdict = await service().moderateFile({
      buffer: await png(),
      originalname: 'notes.bin',
      mimetype: 'application/octet-stream',
    });
    expect(verdict.allowed).toBe(false);
  });

  it('reads text documents', async () => {
    const fetch = guardSays('safe');
    const verdict = await service().moderateFile({
      buffer: Buffer.from('kill yourself'),
      originalname: 'memo.txt',
    });
    expect(verdict.allowed).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('blocks on the file name alone', async () => {
    const verdict = await service().moderateFile({
      buffer: Buffer.from([1, 2, 3]),
      originalname: 'kill yourself.zip',
    });
    expect(verdict.allowed).toBe(false);
  });

  it('says so when it cannot look inside', async () => {
    expect(
      await service().moderateFile({
        buffer: Buffer.from([1, 2, 3]),
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
      }),
    ).toEqual({ allowed: true, scanned: false });
  });
});

describe('voice', () => {
  const voice = {
    buffer: Buffer.from([1, 2, 3]),
    originalname: 'note.ogg',
    mimetype: 'audio/ogg',
  };

  it('blocks on what was said', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: 'go kill yourself' })),
    );
    const verdict = await service({
      OPENAI_API_KEY: 'k',
    }).moderateFile(voice);
    expect(verdict.allowed).toBe(false);
  });

  it('passes unscanned when no transcription provider is set', async () => {
    expect(await service({}).moderateFile(voice)).toEqual({
      allowed: true,
      scanned: false,
    });
  });
});

describe('when the provider is down', () => {
  it('fails open and reports the content as unscanned', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    expect(await service().moderateText('hello')).toEqual({
      allowed: true,
      scanned: false,
    });
  });

  it('still applies the local filter', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(service().assertTextAllowed('kill yourself')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('treats an error status as unscanned, not safe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 500 }),
    );
    expect((await service().moderateText('hello')).scanned).toBe(false);
  });
});
