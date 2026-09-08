import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { S3StorageDriver, type S3DriverConfig } from './s3-driver.js';

const cfg: S3DriverConfig = {
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  bucket: 'uploads',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  forcePathStyle: true,
};

function res(
  body: string | ArrayBuffer,
  init: ResponseInit = { status: 200 },
): Response {
  // 204/205/304 cannot carry a body per the Response spec.
  const nullBody = [204, 205, 304].includes(init.status ?? 200);
  return new Response(nullBody ? null : body, init);
}

describe('S3StorageDriver', () => {
  afterEach(() => vi.restoreAllMocks());

  it('signs a PUT: path-style URL, SigV4 auth header, body hash header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(''));
    const driver = new S3StorageDriver(cfg);
    const body = Buffer.from('hello world');

    await driver.put('ws1/ab/abc.txt', body);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://minio:9000/uploads/ws1/ab/abc.txt');
    expect((init as RequestInit).method).toBe('PUT');

    const h = (init as RequestInit).headers as Record<string, string>;
    expect(h.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
    expect(h.Authorization).toContain('host;x-amz-content-sha256;x-amz-date');
    expect(h['x-amz-content-sha256']).toBe(
      createHash('sha256').update(body).digest('hex'),
    );
    expect(h['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it('uses a virtual-hosted URL when forcePathStyle is false', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(''));
    const driver = new S3StorageDriver({ ...cfg, forcePathStyle: false });

    await driver.put('k.bin', Buffer.from('x'));

    expect(fetchMock.mock.calls[0][0]).toBe('http://uploads.minio:9000/k.bin');
    const h = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    // host header must match the vhost so the signature verifies server-side
    expect(h.host).toBe('uploads.minio:9000');
  });

  it('get returns the object bytes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      res(new TextEncoder().encode('DATA').buffer),
    );
    const out = await new S3StorageDriver(cfg).get('k');
    expect(out.toString()).toBe('DATA');
  });

  it('exists: 404 -> false, 200 -> true', async () => {
    const driver = new S3StorageDriver(cfg);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res('', { status: 404 }));
    expect(await driver.exists('missing')).toBe(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res('', { status: 200 }));
    expect(await driver.exists('there')).toBe(true);
  });

  it('delete treats 204 and 404 alike (gone is gone)', async () => {
    const driver = new S3StorageDriver(cfg);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res('', { status: 204 }));
    expect(await driver.delete('a')).toBe(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res('', { status: 404 }));
    expect(await driver.delete('b')).toBe(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res('', { status: 500 }));
    expect(await driver.delete('c')).toBe(false);
  });

  it('listKeys parses ListObjectsV2 XML and follows the continuation token', async () => {
    const page1 =
      '<ListBucketResult><Contents><Key>ws/a.txt</Key></Contents>' +
      '<Contents><Key>ws/b&amp;c.txt</Key></Contents>' +
      '<IsTruncated>true</IsTruncated>' +
      '<NextContinuationToken>TOKEN2</NextContinuationToken></ListBucketResult>';
    const page2 =
      '<ListBucketResult><Contents><Key>ws/d.txt</Key></Contents>' +
      '<IsTruncated>false</IsTruncated></ListBucketResult>';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(res(page1))
      .mockResolvedValueOnce(res(page2));

    const keys = await new S3StorageDriver(cfg).listKeys();

    expect(keys).toEqual(['ws/a.txt', 'ws/b&c.txt', 'ws/d.txt']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('continuation-token=TOKEN2');
  });

  it('throws with the provider body on a failed PUT', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      res('<Error>AccessDenied</Error>', { status: 403 }),
    );
    await expect(
      new S3StorageDriver(cfg).put('k', Buffer.from('x')),
    ).rejects.toThrow(/HTTP 403/);
  });
});
