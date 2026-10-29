import type { AIAgentMessageContent, Message } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AgentAvatarProvider,
  AppEntityProvider,
} from './agent-avatar-context.js';
import {
  AppConnectProvider,
  type AppConnector,
} from './app-connect-context.js';
import { AgentMessageCard } from './agent-message-card.js';

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '$evt-1',
    roomId: '!room:example.org',
    senderId: '@app-int-1:example.org',
    senderName: 'Asana · balram',
    kind: 'text',
    body: 'Hi! How can I help you with Asana today?',
    timestamp: 1_700_000_000_000,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

function createEvent(
  overrides: Partial<AIAgentMessageContent> = {},
): AIAgentMessageContent {
  return {
    type: 'mie.ai.agent',
    agentId: 'int-1',
    status: 'completed',
    responseText: 'Hi! How can I help you with Asana today?',
    ...overrides,
  };
}

function renderCard(event: AIAgentMessageContent) {
  return render(
    <TooltipProvider>
      <AgentMessageCard message={createMessage()} event={event} />
    </TooltipProvider>,
  );
}

describe('AgentMessageCard — connected app replies', () => {
  it('renders a legacy app reply (role "App") as the app with its logo and APP badge', () => {
    const { container } = renderCard(
      createEvent({ agentName: 'Asana · balram', agentRole: 'App' }),
    );

    expect(screen.getByText('Asana')).toBeInTheDocument();
    expect(screen.queryByText('Asana · balram')).not.toBeInTheDocument();
    expect(screen.queryByText('balram')).not.toBeInTheDocument();
    expect(
      container.querySelector('[title="Connected as balram"]'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^app$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^ai agent$/i)).not.toBeInTheDocument();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.simpleicons.org/asana',
    );
  });

  it('keeps the AI AGENT badge for a real agent run', () => {
    renderCard(createEvent({ agentName: 'Research Bot' }));

    expect(screen.getByText('Research Bot')).toBeInTheDocument();
    expect(screen.getByText(/^ai agent$/i)).toBeInTheDocument();
  });

  it("shows an agent's current name, not the one the reply was posted with", () => {
    render(
      <TooltipProvider>
        <AgentAvatarProvider
          value={({ id }) =>
            id === 'agent-1'
              ? { kind: 'agent', name: 'Release Captain' }
              : undefined
          }
        >
          <AgentMessageCard
            message={createMessage({ senderName: 'Research Bot' })}
            event={createEvent({
              agentId: 'agent-1',
              agentName: 'Research Bot',
            })}
          />
        </AgentAvatarProvider>
      </TooltipProvider>,
    );

    expect(screen.getByText('Release Captain')).toBeInTheDocument();
    expect(screen.queryByText('Research Bot')).not.toBeInTheDocument();
  });

  it("shows a renamed app's current name and logo from the live resolver", () => {
    const { container } = render(
      <TooltipProvider>
        <AppEntityProvider
          value={({ id }) =>
            id === 'int-1'
              ? {
                  id: 'int-1',
                  name: 'Team Asana',
                  provider: 'asana',
                  logoUrl: 'https://cdn.example/asana.png',
                }
              : undefined
          }
        >
          <AgentMessageCard
            message={createMessage()}
            event={createEvent({
              agentName: 'Asana · balram',
              agentRole: 'App',
            })}
          />
        </AppEntityProvider>
      </TooltipProvider>,
    );

    expect(screen.getByText('Team Asana')).toBeInTheDocument();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example/asana.png',
    );
  });
});

describe('AgentMessageCard — apps to connect', () => {
  const needs: AIAgentMessageContent['connectionsNeeded'] = [
    { provider: 'GMAIL', label: 'Gmail', reason: 'not_connected' },
    { provider: 'SLACK', label: 'Slack', reason: 'reconnect' },
  ];

  function renderWith(connector: AppConnector, onRetry?: () => void) {
    return render(
      <TooltipProvider>
        <AppConnectProvider value={connector}>
          <AgentMessageCard
            message={createMessage({ senderName: 'Gmail PA' })}
            event={createEvent({
              agentId: 'agent-1',
              agentName: 'Gmail PA',
              connectionsNeeded: needs,
            })}
            onRetry={onRetry}
          />
        </AppConnectProvider>
      </TooltipProvider>,
    );
  }

  it('offers Connect and Reconnect in the reply, running the host connect flow', async () => {
    const connect = vi.fn();
    renderWith({ connect, isConnected: () => false });

    expect(screen.getByText('Connect Gmail')).toBeInTheDocument();
    expect(screen.getByText('Reconnect Slack')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() => expect(connect).toHaveBeenCalledWith('GMAIL', 'Gmail'));
    expect(
      screen.getByRole('button', { name: /^reconnect$/i }),
    ).toBeInTheDocument();
  });

  it('turns into "connected" with Ask again once every app is connected', () => {
    const onRetry = vi.fn();
    renderWith({ connect: vi.fn(), isConnected: () => true }, onRetry);

    expect(screen.getByText('Gmail connected')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^connect$/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ask again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
