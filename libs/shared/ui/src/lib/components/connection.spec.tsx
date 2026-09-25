import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionCard, toConnectionState } from './connection.js';

describe('toConnectionState', () => {
  it.each([
    ['CONNECTED', 'connected'],
    ['connected', 'connected'],
    ['CONNECTING', 'connecting'],
    ['EXPIRED', 'expired'],
    ['REVOKED', 'expired'],
    ['ERROR', 'error'],
    ['DISCONNECTED', 'disconnected'],
    [undefined, 'disconnected'],
  ] as const)('%s → %s', (input, expected) => {
    expect(toConnectionState(input)).toBe(expected);
  });
});

describe('ConnectionCard', () => {
  const base = { name: 'Gmail', icon: <span>G</span> };

  it('offers Connect when not linked', async () => {
    const onConnect = vi.fn();
    render(<ConnectionCard {...base} state="disconnected" onConnect={onConnect} />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('shows account, last sync and Disconnect when connected', async () => {
    const onDisconnect = vi.fn();
    render(
      <ConnectionCard
        {...base}
        state="connected"
        account="me@example.com"
        lastSyncAt={null}
        onDisconnect={onDisconnect}
      />,
    );
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('turns an expired connection into a Reconnect prompt', async () => {
    const onReconnect = vi.fn();
    render(
      <ConnectionCard
        {...base}
        state="expired"
        onReconnect={onReconnect}
        onDisconnect={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/expired/i);
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('surfaces the provider error message', () => {
    render(<ConnectionCard {...base} state="error" errorMessage="Token rejected" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Token rejected');
  });

  it('disables Connect without permission', () => {
    render(
      <ConnectionCard {...base} state="disconnected" canConnect={false} onConnect={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });
});
