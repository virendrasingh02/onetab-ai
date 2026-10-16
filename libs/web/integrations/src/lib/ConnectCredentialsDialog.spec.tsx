import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCapabilities } from '@org/types';
import { ConnectCredentialsDialog } from './ConnectCredentialsDialog.js';

const jira: IntegrationCapabilities = {
  provider: 'JIRA',
  displayName: 'Jira',
  description: 'Issues and projects.',
  category: 'Project management',
  connectorCategory: 'project_management',
  authType: 'BEARER',
  supportsSync: false,
  supportsWebhooks: false,
  supportsMessaging: false,
  supportsCustomEndpoints: false,
  scopes: [{ scope: 'read:jira-work', description: 'Search and read issues' }],
  credentialFields: [
    { key: 'domain', label: 'Jira site' },
    { key: 'email', label: 'Account email' },
    { key: 'apiToken', label: 'API token', secret: true },
    { key: 'note', label: 'Note', optional: true },
  ],
};

const app = { name: 'Jira', icon: null, capabilities: jira };

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });
}

describe('ConnectCredentialsDialog', () => {
  it('renders the fields the provider declares and keeps the button off until the required ones are filled', () => {
    render(
      <ConnectCredentialsDialog app={app} onOpenChange={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText('Connect Jira')).toBeInTheDocument();
    expect(screen.getByLabelText('API token', { exact: false })).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByText('Search and read issues')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Check and connect' });
    expect(submit).toBeDisabled();
    fill('Jira site', 'acme.atlassian.net');
    fill('Account email', 'a@acme.test');
    expect(submit).toBeDisabled();
    fill('API token', 'tok');
    expect(submit).toBeEnabled();
  });

  it('sends trimmed values, leaves out empty optional ones, and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ConnectCredentialsDialog app={app} onOpenChange={onOpenChange} onSubmit={onSubmit} />,
    );

    fill('Jira site', ' acme.atlassian.net ');
    fill('Account email', 'a@acme.test');
    fill('API token', 'tok');
    fireEvent.click(screen.getByRole('button', { name: 'Check and connect' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSubmit).toHaveBeenCalledWith({
      domain: 'acme.atlassian.net',
      email: 'a@acme.test',
      apiToken: 'tok',
    });
  });

  it('shows the server error and stays open when the credentials are rejected', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Jira rejected the API token.'));
    const onOpenChange = vi.fn();
    render(
      <ConnectCredentialsDialog app={app} onOpenChange={onOpenChange} onSubmit={onSubmit} />,
    );

    fill('Jira site', 'acme.atlassian.net');
    fill('Account email', 'a@acme.test');
    fill('API token', 'bad');
    fireEvent.click(screen.getByRole('button', { name: 'Check and connect' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Jira rejected the API token.',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
