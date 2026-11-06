import { describe, expect, it, vi } from 'vitest';
import { createWithUniqueSlug, nextFreeSlug } from './unique-slug';

/** The error shape Prisma 7 raises through the pg driver adapter. */
const uniqueError = (...fields: string[]) =>
  Object.assign(new Error('unique'), {
    code: 'P2002',
    meta: {
      modelName: 'Project',
      driverAdapterError: { cause: { constraint: { fields } } },
    },
  });

describe('nextFreeSlug', () => {
  it('keeps a free slug as it is', () => {
    expect(nextFreeSlug('marketing', ['sales'])).toBe('marketing');
  });

  it('takes the first free number', () => {
    expect(
      nextFreeSlug('marketing', ['marketing', 'marketing-2', 'marketing-4']),
    ).toBe('marketing-3');
  });

  it('stays within maxLength, without a doubled hyphen', () => {
    const slug = nextFreeSlug('abcd-efgh', ['abcd-efgh'.slice(0, 7)], 7);
    expect(slug).toBe('abcd-2');
  });
});

describe('createWithUniqueSlug', () => {
  it('skips slugs already taken', async () => {
    const create = vi.fn(async (slug: string) => slug);
    await expect(
      createWithUniqueSlug({
        base: 'marketing',
        findTaken: async () => ['marketing'],
        create,
      }),
    ).resolves.toBe('marketing-2');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries when a concurrent request wins the slug', async () => {
    const create = vi
      .fn<(slug: string) => Promise<string>>()
      .mockRejectedValueOnce(uniqueError('"workspaceId"', 'slug'))
      .mockImplementation(async (slug) => slug);
    await expect(
      createWithUniqueSlug({
        base: 'marketing',
        // The lookup never sees the winner, as under a real race.
        findTaken: async () => [],
        create,
      }),
    ).resolves.toBe('marketing-2');
  });

  it('retries a listed generated column, keeping the slug', async () => {
    const create = vi
      .fn<(slug: string) => Promise<string>>()
      .mockRejectedValueOnce(uniqueError('"workspaceId"', '"ticketPrefix"'))
      .mockImplementation(async (slug) => slug);
    await expect(
      createWithUniqueSlug({
        base: 'marketing',
        findTaken: async () => [],
        create,
        retryOnFields: ['ticketPrefix'],
      }),
    ).resolves.toBe('marketing');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry a violation on another column', async () => {
    const error = uniqueError('"workspaceId"', '"ticketPrefix"');
    const create = vi.fn().mockRejectedValue(error);
    await expect(
      createWithUniqueSlug({
        base: 'marketing',
        findTaken: async () => [],
        create,
      }),
    ).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt limit', async () => {
    const create = vi.fn().mockRejectedValue(uniqueError('slug'));
    await expect(
      createWithUniqueSlug({
        base: 'marketing',
        findTaken: async () => [],
        create,
        attempts: 3,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(3);
  });
});
