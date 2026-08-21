import type { Message } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { render, screen } from '@testing-library/react';
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
});
