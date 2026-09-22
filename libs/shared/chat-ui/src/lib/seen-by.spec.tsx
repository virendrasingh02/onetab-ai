import type { MessageReader } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatReaderTime, SeenBy } from './seen-by.js';

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('SeenBy', () => {
  const sampleReaders: MessageReader[] = [
    {
      userId: '@alice:example.org',
      displayName: 'Alice',
      avatarUrl: 'https://example.org/alice.png',
      seenAt: 1_700_000_000_000,
    },
    {
      userId: '@bob:example.org',
      displayName: 'Bob',
      avatarUrl: undefined,
      seenAt: 1_700_000_060_000,
    },
    {
      userId: '@charlie:example.org',
      displayName: 'Charlie',
      avatarUrl: undefined,
      seenAt: 1_700_000_120_000,
    },
    {
      userId: '@david:example.org',
      displayName: 'David',
      avatarUrl: undefined,
      seenAt: 1_700_000_180_000,
    },
  ];

  it('renders nothing when readers list is empty', () => {
    const { container } = renderWithProviders(<SeenBy readers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders direct message style with double checkmark and timestamp', () => {
    renderWithProviders(
      <SeenBy
        readers={[sampleReaders[0]]}
        roomKind="direct"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/Seen/);
  });

  it('formats reader time correctly', () => {
    const time = formatReaderTime(sampleReaders[0].seenAt);
    expect(typeof time).toBe('string');
    expect(time.length).toBeGreaterThan(0);
  });

  it('renders single reader in channels/groups', () => {
    renderWithProviders(
      <SeenBy
        readers={[sampleReaders[0]]}
        roomKind="channel"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Seen by Alice');
  });

  it('renders two readers in channels/groups', () => {
    renderWithProviders(
      <SeenBy
        readers={[sampleReaders[0], sampleReaders[1]]}
        roomKind="channel"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Seen by Alice, Bob');
  });

  it('renders compact count when 4 or more readers', () => {
    renderWithProviders(
      <SeenBy
        readers={sampleReaders}
        roomKind="channel"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Seen by 4');
  });

  it('opens popover on click and shows all readers with names', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SeenBy
        readers={sampleReaders}
        roomKind="channel"
      />,
    );

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(await screen.findByText('Seen by 4 people')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('David')).toBeInTheDocument();
  });

  it('supports keyboard navigation (Enter key opens popover)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SeenBy
        readers={[sampleReaders[0]]}
        roomKind="channel"
      />,
    );

    const trigger = screen.getByRole('button');
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Seen by 1 person')).toBeInTheDocument();
  });
});
