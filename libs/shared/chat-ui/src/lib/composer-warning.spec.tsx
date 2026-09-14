import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ComposerWarning,
  formatTargetSentence,
  formatActionLabel,
  type ComposerWarningState,
} from './composer-warning.js';

describe('formatTargetSentence', () => {
  it('formats channel user with add permission', () => {
    const s = formatTargetSentence(
      { id: 'u1', name: 'Alice', kind: 'user', addAction: 'channel-member' },
      'channel',
      'general',
    );
    expect(s).toBe("@Alice isn't in #general yet.");
  });

  it('formats channel user without add permission', () => {
    const s = formatTargetSentence(
      { id: 'u1', name: 'Alice', kind: 'user', addAction: 'none' },
      'channel',
      'general',
    );
    expect(s).toBe(
      "@Alice isn't in #general — ask an admin to add them so they can see this.",
    );
  });

  it('formats channel agent with add permission', () => {
    const s = formatTargetSentence(
      { id: 'a1', name: 'Bot', kind: 'agent', addAction: 'channel-agent' },
      'channel',
      'dev',
    );
    expect(s).toBe("@Bot isn't connected to #dev.");
  });

  it('formats channel coworker without add permission', () => {
    const s = formatTargetSentence(
      { id: 'c1', name: 'Sam', kind: 'coworker', addAction: 'none' },
      'channel',
      'dev',
    );
    expect(s).toBe("@Sam isn't connected to #dev and won't see this.");
  });

  it('formats channel app with add permission', () => {
    const s = formatTargetSentence(
      { id: 'app1', name: 'GitHub', kind: 'app', addAction: 'channel-app' },
      'channel',
      'dev',
    );
    expect(s).toBe("@GitHub isn't connected to #dev.");
  });

  it('formats dm user', () => {
    const s = formatTargetSentence(
      { id: 'u2', name: 'Bob', kind: 'user', addAction: 'start-group' },
      'dm',
    );
    expect(s).toBe("@Bob isn't in this conversation.");
  });

  it('formats group-dm user', () => {
    const s = formatTargetSentence(
      { id: 'u2', name: 'Bob', kind: 'user', addAction: 'group-dm-member' },
      'group-dm',
    );
    expect(s).toBe("@Bob isn't in this conversation yet.");
  });

  it('formats 1:1 agent conversation third-party mention', () => {
    const s = formatTargetSentence(
      { id: 'u3', name: 'Charlie', kind: 'user', addAction: 'none' },
      'agent',
      undefined,
      'MyAgent',
    );
    expect(s).toBe(
      "@Charlie won't see this — this conversation is just between you and @MyAgent.",
    );
  });
});

describe('formatActionLabel', () => {
  it('maps add actions to human button labels', () => {
    expect(formatActionLabel('channel-member')).toBe('Add to channel');
    expect(formatActionLabel('channel-agent')).toBe('Add to channel');
    expect(formatActionLabel('channel-app')).toBe('Connect app');
    expect(formatActionLabel('group-dm-member')).toBe('Add to conversation');
    expect(formatActionLabel('start-group')).toBe('Start a group');
    expect(formatActionLabel('none')).toBeNull();
  });
});

describe('ComposerWarning Component', () => {
  const state: ComposerWarningState = {
    targets: [
      {
        id: 'user-1',
        name: 'Dave',
        kind: 'user',
        addAction: 'channel-member',
      },
    ],
  };

  it('renders with role="status" and aria-live="polite"', () => {
    render(
      <ComposerWarning
        state={state}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
        channelName="project-x"
        surfaceKind="channel"
      />,
    );

    const alert = screen.getByRole('status');
    expect(alert).toBeDefined();
    expect(alert.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText("@Dave isn't in #project-x yet.")).toBeDefined();
    expect(screen.getByText('Add to channel')).toBeDefined();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <ComposerWarning
        state={state}
        onDismiss={onDismiss}
        onAdd={vi.fn()}
        channelName="project-x"
      />,
    );

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onAdd with target id and addAction when action button is clicked', () => {
    const onAdd = vi.fn();
    render(
      <ComposerWarning
        state={state}
        onDismiss={vi.fn()}
        onAdd={onAdd}
        channelName="project-x"
      />,
    );

    fireEvent.click(screen.getByText('Add to channel'));
    expect(onAdd).toHaveBeenCalledWith('user-1', 'channel-member');
  });

  it('returns null when state is empty', () => {
    const { container } = render(
      <ComposerWarning
        state={{ targets: [] }}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
