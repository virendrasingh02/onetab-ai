import { describe, expect, it, vi } from 'vitest';
import {
  fetchBlob,
  saveBlob,
  uploadBinary,
  uploadMultipart,
} from './web-transfer';

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('uploadMultipart', () => {
  it('posts the blob as form data without forcing a content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ id: 'up_1' }, 201));
    const blob = new Blob(['hello'], { type: 'text/plain' });

    const result = await uploadMultipart(fetchImpl, 'https://api/u', blob, {
      filename: 'a.txt',
      headers: { Authorization: 'Bearer t' },
    });

    expect(result).toEqual({ status: 201, body: '{"id":"up_1"}' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api/u');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer t' });
    const form = init.body as FormData;
    const sent = form.get('file') as File;
    expect(sent.name).toBe('a.txt');
    expect(await sent.text()).toBe('hello');
  });
});

describe('uploadBinary', () => {
  it('sends the raw bytes with the mime type', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ content_uri: 'mxc://s/m' }));
    const blob = new Blob(['img']);

    const result = await uploadBinary(fetchImpl, 'https://hs/upload', blob, {
      mimeType: 'image/png',
      headers: { Authorization: 'Bearer m' },
    });

    expect(JSON.parse(result.body)).toEqual({ content_uri: 'mxc://s/m' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers).toEqual({
      Authorization: 'Bearer m',
      'Content-Type': 'image/png',
    });
    expect(init.body).toBe(blob);
  });
});

describe('fetchBlob', () => {
  it('sends the auth headers and fails on an error status', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('bytes'))
      .mockResolvedValueOnce(new Response('', { status: 403 }));

    const blob = await fetchBlob(fetchImpl, 'https://hs/media', {
      Authorization: 'Bearer m',
    });
    expect(await blob.text()).toBe('bytes');
    expect(fetchImpl.mock.calls[0][1]).toEqual({
      headers: { Authorization: 'Bearer m' },
    });
    await expect(fetchBlob(fetchImpl, 'https://hs/media', {})).rejects.toThrow(
      'Download failed (403).',
    );
  });
});

describe('saveBlob', () => {
  it('clicks a download link and revokes the URL later', () => {
    const link = { href: '', download: '', rel: '', click: vi.fn() };
    const urls = {
      createObjectURL: vi.fn(() => 'blob:1'),
      revokeObjectURL: vi.fn(),
    };
    let later: (() => void) | undefined;

    saveBlob(
      { createElement: () => link },
      urls,
      new Blob(['x']),
      'report.pdf',
      (run) => {
        later = run;
      },
    );

    expect(link).toMatchObject({ href: 'blob:1', download: 'report.pdf' });
    expect(link.click).toHaveBeenCalled();
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
    later?.();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });
});
