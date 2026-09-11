import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformImage } from './platform-image.js';

vi.mock('@org/hooks', () => ({
  useAuthenticatedMediaSrc: (src?: string) => src,
}));

describe('PlatformImage', () => {
  it('renders accessible fallback when src is null or empty', () => {
    render(<PlatformImage src={null} alt="Test image" />);
    expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    expect(screen.getByText('Image unavailable')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <PlatformImage
        src={null}
        alt="Custom fallback image"
        fallback={<div data-testid="custom-fallback">Custom Error</div>}
      />,
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('renders image with proper alt and variant query param for string URL', () => {
    render(
      <PlatformImage
        src="/files/token123"
        variant="medium"
        alt="A scenic view"
      />,
    );
    const img = screen.getByRole('img', { name: 'A scenic view' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/files/token123?variant=medium');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('resolves variant from MediaAssetSource object with responsive srcset', () => {
    const asset = {
      contentUrl: '/files/token_content',
      thumbnailUrl: '/files/token_thumb',
      variants: {
        thumbnail: '/files/token_thumb',
        small: '/files/token_small',
        medium: '/files/token_medium',
        large: '/files/token_large',
      },
    };

    render(
      <PlatformImage
        src={asset}
        variant="thumbnail"
        alt="Attachment thumbnail"
      />,
    );
    const img = screen.getByRole('img', { name: 'Attachment thumbnail' });
    expect(img).toHaveAttribute('src', '/files/token_thumb');
    expect(img.getAttribute('srcset')).toContain('/files/token_small 480w');
    expect(img.getAttribute('srcset')).toContain('/files/token_large 1920w');
  });

  it('switches to fallback state when image fails to load', () => {
    render(
      <PlatformImage
        src="https://example.com/broken.jpg"
        alt="Broken image"
      />,
    );
    const img = screen.getByRole('img', { name: 'Broken image' });
    fireEvent.error(img);

    expect(screen.getByText('Image unavailable')).toBeInTheDocument();
  });
});
