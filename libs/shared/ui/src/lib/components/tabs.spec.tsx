import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs.js';

describe('Tabs Component', () => {
  it('renders tabs with active content', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account Content</TabsContent>
        <TabsContent value="password">Password Content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText('Account Content')).toBeInTheDocument();
    expect(screen.queryByText('Password Content')).not.toBeInTheDocument();
  });

  it('switches tabs on trigger click or pointer down', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account Content</TabsContent>
        <TabsContent value="password">Password Content</TabsContent>
      </Tabs>,
    );

    const passwordTab = screen.getByRole('tab', { name: 'Password' });
    await user.click(passwordTab);

    expect(await screen.findByText('Password Content')).toBeInTheDocument();
    expect(screen.queryByText('Account Content')).not.toBeInTheDocument();
  });

  it('renders count badges and custom icons', () => {
    render(
      <Tabs defaultValue="inbox">
        <TabsList variant="c-tabs-7">
          <TabsTrigger value="inbox" count={12}>
            Inbox
          </TabsTrigger>
          <TabsTrigger value="unread" count={3}>
            Unread
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('supports disabled tabs', () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">Active</TabsTrigger>
          <TabsTrigger value="two" disabled>
            Disabled
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const disabledTab = screen.getByRole('tab', { name: 'Disabled' });
    expect(disabledTab).toBeDisabled();
    expect(disabledTab).toHaveClass('disabled:pointer-events-none');
  });

  it('supports different variants like underline and segmented', () => {
    const { rerender } = render(
      <Tabs defaultValue="general">
        <TabsList variant="underline">
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'underline');

    rerender(
      <Tabs defaultValue="general">
        <TabsList variant="segmented">
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'segmented');
  });
});
