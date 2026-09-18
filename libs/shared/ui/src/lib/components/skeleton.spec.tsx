import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  SkeletonRow,
  SkeletonList,
  WorkspaceMenuSkeleton,
  ChannelNavSkeleton,
  DirectMessagesNavSkeleton,
  ResourceNavSkeleton,
  ChatHeaderSkeleton,
  ChatConversationSkeleton,
} from './skeleton.js';

describe('Skeleton primitives', () => {
  it('renders base Skeleton with pulse animation and aria-hidden', () => {
    const { container } = render(<Skeleton className="w-20 h-4" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el?.className).toContain('animate-pulse');
    expect(el?.className).toContain('motion-reduce:animate-none');
    expect(el?.className).toContain('w-20');
  });

  it('renders SkeletonAvatar with correct sizing and shape', () => {
    const { container, rerender } = render(<SkeletonAvatar size="sm" shape="rounded" />);
    let avatar = container.querySelector('[data-slot="skeleton-avatar"]');
    expect(avatar?.className).toContain('size-6');
    expect(avatar?.className).toContain('rounded-lg');

    rerender(<SkeletonAvatar size="lg" shape="circle" />);
    avatar = container.querySelector('[data-slot="skeleton-avatar"]');
    expect(avatar?.className).toContain('size-10');
    expect(avatar?.className).toContain('rounded-full');
  });

  it('renders SkeletonText with varied typography sizes', () => {
    const { container, rerender } = render(<SkeletonText size="sm" width="120px" />);
    let text = container.querySelector('[data-slot="skeleton-text"]');
    expect(text?.className).toContain('h-3.5');
    expect(text).toHaveStyle({ width: '120px' });

    rerender(<SkeletonText size="base" />);
    text = container.querySelector('[data-slot="skeleton-text"]');
    expect(text?.className).toContain('h-4');
    expect(text?.className).toContain('w-full');
  });

  it('renders SkeletonRow with avatar and trailing action', () => {
    const { container } = render(
      <SkeletonRow leading="avatar" avatarSize="sm" lines={2} trailing="action" />,
    );
    expect(container.querySelector('[data-slot="skeleton-row"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="skeleton-avatar"]')).not.toBeNull();
  });

  it('renders SkeletonList with accessible role and aria-busy', () => {
    render(<SkeletonList rows={4} withAvatar />);
    const list = screen.getByRole('status');
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders WorkspaceMenuSkeleton preserving workspace switcher dimensions', () => {
    const { container } = render(<WorkspaceMenuSkeleton />);
    const menu = container.querySelector('[data-slot="workspace-menu-skeleton"]');
    expect(menu).not.toBeNull();
    expect(container.querySelector('[data-slot="skeleton-avatar"]')).not.toBeNull();
  });

  it('renders ChannelNavSkeleton with aria-busy', () => {
    render(<ChannelNavSkeleton rows={3} />);
    const nav = screen.getByRole('status', { name: /loading channels/i });
    expect(nav).toHaveAttribute('aria-busy', 'true');
  });

  it('renders DirectMessagesNavSkeleton with aria-busy', () => {
    render(<DirectMessagesNavSkeleton rows={3} />);
    const nav = screen.getByRole('status', { name: /loading direct messages/i });
    expect(nav).toHaveAttribute('aria-busy', 'true');
  });

  it('renders ResourceNavSkeleton with aria-busy', () => {
    render(<ResourceNavSkeleton rows={3} shape="rounded" />);
    const nav = screen.getByRole('status', { name: /loading resources/i });
    expect(nav).toHaveAttribute('aria-busy', 'true');
  });

  it('renders ChatHeaderSkeleton preserving min-h-12 and sticky positioning', () => {
    const { container } = render(<ChatHeaderSkeleton avatarShape="circle" />);
    const header = container.querySelector('[data-slot="chat-header-skeleton"]');
    expect(header).not.toBeNull();
    expect(header?.querySelector('.min-h-12')).not.toBeNull();
    expect(header?.className).toContain('sticky');
  });

  it('renders ChatConversationSkeleton with header and feed placeholders', () => {
    render(<ChatConversationSkeleton />);
    expect(screen.getByRole('status', { name: /loading conversation header/i })).toBeInTheDocument();
  });
});
