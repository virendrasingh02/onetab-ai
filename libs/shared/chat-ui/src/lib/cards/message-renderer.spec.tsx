import type { Message } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageRenderer } from './message-renderer.js';

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '$evt-1',
    roomId: '!room:example.org',
    senderId: '@user:example.org',
    senderName: 'Alice',
    kind: 'text',
    body: 'Hello world',
    timestamp: 1_700_000_000_000,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

describe('MessageRenderer', () => {
  it('renders standard message with fallback ChatBubble', () => {
    const msg = createMockMessage({ body: 'Standard plain text message' });
    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Standard plain text message')).toBeInTheDocument();
  });

  it('renders AI Agent Card in completed state with tools and sources', () => {
    const msg = createMockMessage({
      senderName: 'Research Agent',
      structuredEvent: {
        type: 'mie.ai.agent',
        agentId: 'agent-research',
        agentName: 'Research Agent',
        status: 'completed',
        model: 'GPT-5',
        durationMs: 18400,
        summary: 'Analyzed 12 sources on quantum computing',
        tools: [
          { name: 'web_search', status: 'success', durationMs: 1200 },
        ],
        sources: [
          { title: 'Quantum Computing Overview', url: 'https://example.org/quantum' },
        ],
        suggestedActions: [
          { id: 'act-1', label: 'Create Task' },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Research Agent')).toBeInTheDocument();
    expect(screen.getByText('GPT-5')).toBeInTheDocument();
    expect(screen.getByText('Analyzed 12 sources on quantum computing')).toBeInTheDocument();
    expect(screen.getByText('Create Task')).toBeInTheDocument();
  });

  it('renders AI Agent Card in running state', () => {
    const msg = createMockMessage({
      senderName: 'Research Agent',
      structuredEvent: {
        type: 'mie.ai.agent',
        agentId: 'agent-research',
        agentName: 'Research Agent',
        status: 'running',
        model: 'GPT-5',
        tools: [
          { name: 'Collect Sources', status: 'running' },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText(/Executing Autonomous Plan/i)).toBeInTheDocument();
    expect(screen.getByText('Collect Sources')).toBeInTheDocument();
  });

  it('renders App Response Card with structured fields', () => {
    const msg = createMockMessage({
      senderName: 'CRM Bot',
      structuredEvent: {
        type: 'mie.app.response',
        appId: 'crm',
        appName: 'Sales CRM',
        eventType: 'lead.created',
        cardType: 'crm',
        title: 'New Lead Created: John Smith',
        fields: [
          { label: 'Company', value: 'Acme Corporation', inline: true },
          { label: 'Status', value: 'New', inline: true },
        ],
        actions: [
          { id: 'open-lead', label: 'Open Lead' },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('New Lead Created: John Smith')).toBeInTheDocument();
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Open Lead')).toBeInTheDocument();
  });

  it('renders Approval Card and triggers approve callback', async () => {
    const onAction = vi.fn();
    const msg = createMockMessage({
      structuredEvent: {
        type: 'mie.approval',
        approvalId: 'appr-99',
        title: 'Deploy to Production',
        description: 'Publish release v3.0.0',
        status: 'pending',
        riskLevel: 'high',
        sideEffects: ['External side effect'],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} onAction={onAction} />);

    expect(screen.getByText('Deploy to Production')).toBeInTheDocument();
    expect(screen.getByText('External side effect')).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: /Approve Action/i });
    await userEvent.click(approveBtn);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'approve' }),
    );
  });

  it('renders Form Card and validates input', async () => {
    const onAction = vi.fn();
    const msg = createMockMessage({
      structuredEvent: {
        type: 'mie.form',
        formId: 'form-1',
        title: 'Create Customer',
        fields: [
          { id: 'name', name: 'name', label: 'Full Name', type: 'text', required: true },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} onAction={onAction} />);

    expect(screen.getByText('Create Customer')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Submit Form/i });
    await userEvent.click(submitBtn);

    // Empty required field should show error
    expect(screen.getByText('Full Name is required')).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();

    // Type value and submit
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Jane Doe');
    await userEvent.click(submitBtn);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'submit_form',
        payload: { name: 'Jane Doe' },
      }),
    );
  });

  it('renders Workflow Card with step list', () => {
    const msg = createMockMessage({
      structuredEvent: {
        type: 'mie.workflow',
        workflowId: 'wf-1',
        title: 'Marketing Automation Workflow',
        currentStepIndex: 1,
        status: 'running',
        steps: [
          { id: 's1', name: 'Generate Copy', status: 'completed' },
          { id: 's2', name: 'Review Compliance', status: 'running' },
          { id: 's3', name: 'Publish Campaign', status: 'pending' },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Marketing Automation Workflow')).toBeInTheDocument();
    expect(screen.getByText('Generate Copy')).toBeInTheDocument();
    expect(screen.getByText('Review Compliance')).toBeInTheDocument();
    expect(screen.getByText('Publish Campaign')).toBeInTheDocument();
  });

  it('renders File Response Card with downloadable files', () => {
    const msg = createMockMessage({
      structuredEvent: {
        type: 'mie.file',
        title: 'Generated Analysis Artifacts',
        files: [
          { name: 'Q3_Report.pdf', url: 'https://example.com/report.pdf', mimeType: 'application/pdf', size: 102400 },
        ],
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Generated Analysis Artifacts')).toBeInTheDocument();
    expect(screen.getByText('Q3_Report.pdf')).toBeInTheDocument();
  });

  it('renders a System/Activity Event as a timeline row, not a chat bubble', () => {
    const msg = createMockMessage({
      body: 'Outlook Calendar app was added to #agent45 by VR',
      structuredEvent: {
        type: 'mie.system_event',
        eventType: 'app_added',
        conversationType: 'channel',
        conversationId: 'chan-1',
        conversationName: 'agent45',
        actor: { kind: 'user', id: 'admin-1', name: 'VR' },
        target: { kind: 'app', id: 'int-1', name: 'Outlook Calendar' },
        occurredAt: 1_700_000_000_000,
        idempotencyKey: 'k1',
        capabilities: { reactions: true, threading: true, sharing: true, reply: false },
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
    expect(screen.getByText('APP')).toBeInTheDocument();
    expect(screen.getByText(/was added to #agent45 by/)).toBeInTheDocument();
    expect(screen.getByText('VR')).toBeInTheDocument();
  });

  it('renders System Message Card with severity style', () => {
    const msg = createMockMessage({
      structuredEvent: {
        type: 'mie.system',
        severity: 'warning',
        title: 'Database connection retry',
        details: 'Failover in progress',
      },
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(screen.getByText('Database connection retry')).toBeInTheDocument();
    expect(screen.getByText('Failover in progress')).toBeInTheDocument();
  });

  it('renders dedicated GIF message with accessible label', () => {
    const msg = createMockMessage({
      body: '![Thumbs up](https://example.com/thumbs.gif)',
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    expect(
      screen.getByRole('button', { name: /GIF: Thumbs up/i }),
    ).toBeInTheDocument();
    const img = screen.getByAltText('Thumbs up');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/thumbs.gif');
  });

  it('renders dedicated transparent Sticker message with accessible label', () => {
    const msg = createMockMessage({
      body: '![sticker:Party Popper](https://example.com/party.svg)',
    });

    renderWithProviders(<MessageRenderer message={msg} isOwn={false} />);

    const img = screen.getByAltText('Party Popper');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/party.svg');
  });

  it('renders Thread, Reply, and Forward buttons without quick emojis in action toolbar', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    const onReply = vi.fn();
    const onForward = vi.fn();
    const msg = createMockMessage({ body: 'Message with actions' });

    renderWithProviders(
      <MessageRenderer
        message={msg}
        isOwn={false}
        onOpenThread={onOpenThread}
        onReply={onReply}
        onForward={onForward}
      />,
    );

    // Quick emoji buttons should be removed
    expect(screen.queryByRole('button', { name: /React with 👍/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /React with ❤️/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /React with 🔥/i })).not.toBeInTheDocument();

    const threadBtn = screen.getByRole('button', { name: 'Reply in thread' });
    expect(threadBtn).toBeInTheDocument();
    await user.click(threadBtn);
    expect(onOpenThread).toHaveBeenCalledTimes(1);

    const replyBtn = screen.getByRole('button', { name: 'Reply' });
    expect(replyBtn).toBeInTheDocument();
    await user.click(replyBtn);
    expect(onReply).toHaveBeenCalledTimes(1);

    const forwardBtn = screen.getByRole('button', { name: 'Forward message' });
    expect(forwardBtn).toBeInTheDocument();
    await user.click(forwardBtn);
    expect(onForward).toHaveBeenCalledTimes(1);
  });


  describe('More actions menu', () => {
    const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'More actions' }));
    };

    it('keeps the toolbar actions out of the menu and groups the rest', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Menu layout', timestamp: Date.now() })}
          isOwn
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onReply={vi.fn()}
          onOpenThread={vi.fn()}
          onForward={vi.fn()}
          onToggleSave={vi.fn()}
          onCopyLink={vi.fn()}
          onMarkUnread={vi.fn()}
          onRemind={vi.fn()}
          onToggleReplyNotifications={vi.fn()}
          onTogglePin={vi.fn()}
          onCreateTask={vi.fn()}
        />,
      );
      await openMenu(user);

      // Already one click away on the hover toolbar.
      expect(screen.queryByRole('menuitem', { name: /Reply in thread/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /^Reply$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Forward message/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Save for later/i })).not.toBeInTheDocument();

      expect(screen.getByRole('menuitem', { name: /Edit message/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Mark unread/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Remind me about this/i })).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Turn off notifications for replies/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Organize/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Connect to apps/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Delete message…/i })).toBeInTheDocument();
    });

    it('offers no stand-in items for actions the host has not wired', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Read-only host', timestamp: Date.now() })}
          isOwn={false}
          onCopyLink={vi.fn()}
        />,
      );
      await openMenu(user);

      expect(screen.queryByRole('menuitem', { name: /Mark unread/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Remind me/i })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /notifications for replies/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Delete message/i })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
    });

    it('runs the real handlers for mark unread and reply notifications', async () => {
      const user = userEvent.setup();
      const onMarkUnread = vi.fn();
      const onToggleReplyNotifications = vi.fn();
      const { unmount } = renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ timestamp: Date.now() })}
          isOwn={false}
          onMarkUnread={onMarkUnread}
          onToggleReplyNotifications={onToggleReplyNotifications}
          replyNotificationsMuted
        />,
      );

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: /Mark unread/i }));
      expect(onMarkUnread).toHaveBeenCalledTimes(1);

      await openMenu(user);
      // Already muted, so the entry offers to turn them back on.
      await user.click(
        screen.getByRole('menuitem', { name: /Turn on notifications for replies/i }),
      );
      expect(onToggleReplyNotifications).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('sets a reminder at the chosen time', async () => {
      const user = userEvent.setup();
      const onRemind = vi.fn();
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ timestamp: Date.now() })}
          isOwn={false}
          onRemind={onRemind}
        />,
      );

      await openMenu(user);
      // Keyboard, as a submenu is reached without a pointer: jsdom has no
      // layout, so Radix's pointer-grace area would close it mid-move.
      screen.getByRole('menuitem', { name: /Remind me about this/i }).focus();
      await user.keyboard('{ArrowRight}');
      const before = Date.now();
      (await screen.findByRole('menuitem', { name: /In 1 hour/i })).focus();
      await user.keyboard('{Enter}');

      expect(onRemind).toHaveBeenCalledTimes(1);
      const remindAt = onRemind.mock.calls[0][0] as Date;
      const minutesAhead = (remindAt.getTime() - before) / 60_000;
      expect(minutesAhead).toBeGreaterThan(58);
      expect(minutesAhead).toBeLessThan(62);
    });

    it('honours the keyboard shortcuts it shows', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onMarkUnread = vi.fn();
      const onCopyLink = vi.fn();
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ timestamp: Date.now() })}
          isOwn
          onEdit={onEdit}
          onMarkUnread={onMarkUnread}
          onCopyLink={onCopyLink}
        />,
      );

      await openMenu(user);
      await user.keyboard('u');
      expect(onMarkUnread).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await openMenu(user);
      await user.keyboard('l');
      expect(onCopyLink).toHaveBeenCalledTimes(1);

      await openMenu(user);
      await user.keyboard('e');
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });
  describe('Right-click menu', () => {
    const rightClick = () =>
      fireEvent.contextMenu(screen.getByRole('article'), { clientX: 40, clientY: 40 });

    it('offers every action, including the ones the hover toolbar shows', async () => {
      const onOpenThread = vi.fn();
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Right click me', timestamp: Date.now() })}
          isOwn
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onOpenThread={onOpenThread}
          onForward={vi.fn()}
          onToggleSave={vi.fn()}
          onReact={vi.fn()}
          onQuote={vi.fn()}
          onCopyLink={vi.fn()}
        />,
      );
      rightClick();

      expect(await screen.findByRole('menuitem', { name: /Reply in thread/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Quote message/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Add reaction/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Save for later/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Forward message/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Edit message/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Delete message/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('menuitem', { name: /Reply in thread/i }));
      await vi.waitFor(() => expect(onOpenThread).toHaveBeenCalledTimes(1));
    });

    it('never offers edit or delete on someone else’s message to a non-moderator', async () => {
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Not mine', timestamp: Date.now() })}
          isOwn={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onCopyLink={vi.fn()}
        />,
      );
      rightClick();
      expect(await screen.findByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Edit message/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Delete message/i })).not.toBeInTheDocument();
    });

    it('lets a moderator delete someone else’s message', async () => {
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Spam', timestamp: Date.now() })}
          isOwn={false}
          canModerateMessages
          onDelete={vi.fn()}
        />,
      );
      rightClick();
      expect(await screen.findByRole('menuitem', { name: /Delete message/i })).toBeInTheDocument();
      expect(screen.getByText('Moderator')).toBeInTheDocument();
    });

    it('keeps the browser menu over a text selection so Copy still works', () => {
      renderWithProviders(
        <MessageRenderer
          message={createMockMessage({ body: 'Select this text', timestamp: Date.now() })}
          isOwn={false}
          onCopyLink={vi.fn()}
        />,
      );
      const text = screen.getByText('Select this text');
      const range = document.createRange();
      range.selectNodeContents(text);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);

      const notPrevented = fireEvent.contextMenu(text, { clientX: 5, clientY: 5 });
      expect(notPrevented).toBe(true);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      window.getSelection()?.removeAllRanges();
    });
  });
});
