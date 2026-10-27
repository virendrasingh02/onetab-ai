import type { LinkPreview } from '@org/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describeLinkTarget, LinkHoverCard } from './link-hover-card.js';
import { configureLinkPreviewApi, useLinkPreviewStore } from './use-link-preview.js';

const VIDEO_URL = 'https://lgpol.s3.us-east-1.amazonaws.com/v/imaged/802623155v/802623155.mp4';

function readyPreview(url: string): LinkPreview {
  return {
    id: 'p1',
    url,
    normalizedUrl: url,
    title: 'Diamond video',
    description: 'A short clip of the stone',
    domain: 'example.com',
    siteName: 'Example',
    status: 'ready',
    visibility: 'visible',
  };
}

describe('describeLinkTarget', () => {
  it('recognises a direct video file and splits origin from path', () => {
    const target = describeLinkTarget(VIDEO_URL);

    expect(target.kind).toBe('video');
    expect(target.fileType).toBe('MP4');
    expect(target.host).toBe('lgpol.s3.us-east-1.amazonaws.com');
    expect(target.rest).toBe('/v/imaged/802623155v/802623155.mp4');
    expect(target.copyValue).toBe(VIDEO_URL);
    expect(target.insecure).toBe(false);
  });

  it('treats an ordinary page as a plain link and flags plain http', () => {
    const target = describeLinkTarget('http://example.com/docs?a=1#top');

    expect(target.kind).toBe('link');
    expect(target.fileType).toBeUndefined();
    expect(target.rest).toBe('/docs?a=1#top');
    expect(target.insecure).toBe(true);
  });

  it('shows a bare origin without a trailing slash', () => {
    expect(describeLinkTarget('https://example.com/').rest).toBe('');
  });

  it('recognises meeting links', () => {
    expect(describeLinkTarget('https://meet.google.com/abc-defg-hij').kind).toBe('meeting');
    expect(describeLinkTarget('https://us02web.zoom.us/j/123456').kind).toBe('meeting');
    expect(describeLinkTarget('https://zoom.us/pricing').kind).toBe('link');
  });

  it('copies just the address of a mailto link', () => {
    const target = describeLinkTarget('mailto:ada@example.com?subject=Hi');

    expect(target.kind).toBe('email');
    expect(target.host).toBe('ada@example.com');
    expect(target.copyValue).toBe('ada@example.com');
  });

  it('shows internationalised hosts in their punycode form', () => {
    expect(describeLinkTarget('https://аpple.com/login').host).toMatch(/^xn--/);
  });
});

describe('LinkHoverCard', () => {
  const getPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    configureLinkPreviewApi({
      getPreview,
      updateMessageVisibility: vi.fn(),
    });
    useLinkPreviewStore.setState({ previews: {}, loadingUrls: {} });
  });

  it('keeps the link opening in a new tab', () => {
    render(<LinkHoverCard href={VIDEO_URL}>url</LinkHoverCard>);

    const link = screen.getByRole('link', { name: 'url' });
    expect(link).toHaveAttribute('href', VIDEO_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('shows the real destination and actions on hover', async () => {
    const user = userEvent.setup();
    render(<LinkHoverCard href={VIDEO_URL}>url</LinkHoverCard>);

    await user.hover(screen.getByRole('link', { name: 'url' }));

    expect(await screen.findByText('Video')).toBeInTheDocument();
    expect(screen.getByText('MP4')).toBeInTheDocument();
    expect(screen.getByText('lgpol.s3.us-east-1.amazonaws.com')).toBeInTheDocument();
    const open = screen.getByRole('link', { name: 'Open link in a new tab' });
    expect(open).toHaveAttribute('href', VIDEO_URL);
    expect(open).toHaveAttribute('target', '_blank');
  });

  it('copies the link and confirms it', async () => {
    const user = userEvent.setup();
    render(<LinkHoverCard href={VIDEO_URL}>url</LinkHoverCard>);

    await user.hover(screen.getByRole('link', { name: 'url' }));
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(await navigator.clipboard.readText()).toBe(VIDEO_URL);
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });

  it('does not look the page up unless enrichment is on', async () => {
    const user = userEvent.setup();
    render(<LinkHoverCard href="https://example.com/post">post</LinkHoverCard>);

    await user.hover(screen.getByRole('link', { name: 'post' }));
    await screen.findByText('example.com');

    expect(getPreview).not.toHaveBeenCalled();
  });

  it('shows the page title and description once the preview loads', async () => {
    const url = 'https://example.com/post';
    getPreview.mockResolvedValue(readyPreview(url));
    const user = userEvent.setup();
    render(
      <LinkHoverCard href={url} enrich>
        post
      </LinkHoverCard>,
    );

    await user.hover(screen.getByRole('link', { name: 'post' }));

    expect(await screen.findByText('Diamond video')).toBeInTheDocument();
    expect(screen.getByText('A short clip of the stone')).toBeInTheDocument();
    expect(getPreview).toHaveBeenCalledTimes(1);
  });

  it('skips the page lookup for direct file links', async () => {
    const user = userEvent.setup();
    render(
      <LinkHoverCard href={VIDEO_URL} enrich>
        url
      </LinkHoverCard>,
    );

    await user.hover(screen.getByRole('link', { name: 'url' }));
    await screen.findByText('Video');

    expect(getPreview).not.toHaveBeenCalled();
  });

  it('flags a link that is not HTTPS', async () => {
    const user = userEvent.setup();
    render(<LinkHoverCard href="http://example.com/a">a</LinkHoverCard>);

    await user.hover(screen.getByRole('link', { name: 'a' }));

    expect(await screen.findByText(/doesn.t use HTTPS/)).toBeInTheDocument();
  });
});
