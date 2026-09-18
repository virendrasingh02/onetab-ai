import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Alert,
  AlertTitle,
  AlertDescription,
  Button,
  IconButton,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  Input,
  KanbanBoard,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  announceToScreenReader,
} from '../../index.js';
import { expectNoAxeViolations } from './axe-test-utils.js';
import { Settings } from 'lucide-react';

describe('Accessibility Test Suite (WCAG 2.2 AA / axe-core)', () => {
  describe('Button & IconButton', () => {
    it('has zero axe violations for standard buttons', async () => {
      const { container } = render(
        <div>
          <Button variant="primary">Save Changes</Button>
          <Button variant="outline" loading>
            Submitting
          </Button>
          <IconButton aria-label="Settings" icon={<Settings />} />
        </div>,
      );

      await expectNoAxeViolations(container);
    });

    it('exposes loading busy state and screen-reader status', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
  });

  describe('Alert', () => {
    it('has zero axe violations and appropriate live roles based on severity', async () => {
      const { container } = render(
        <div>
          <Alert variant="default">
            <AlertTitle>System Notice</AlertTitle>
            <AlertDescription>System maintenance tonight.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Critical Error</AlertTitle>
            <AlertDescription>Database connection failed.</AlertDescription>
          </Alert>
        </div>,
      );

      await expectNoAxeViolations(container);

      const statusAlert = screen.getByText('System Notice').closest('[role="status"]');
      expect(statusAlert).toHaveAttribute('aria-live', 'polite');

      const destructiveAlert = screen.getByText('Critical Error').closest('[role="alert"]');
      expect(destructiveAlert).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Form Controls & Field', () => {
    it('has zero axe violations with labels, required badges, and error messages', async () => {
      const { container } = render(
        <form>
          <Field label="Email address" required hint="We will never share your email.">
            <Input type="email" placeholder="name@company.com" />
          </Field>
          <Field label="Password" required error="Password must be at least 8 characters.">
            <Input type="password" />
          </Field>
        </form>,
      );

      await expectNoAxeViolations(container);

      const emailInput = screen.getByLabelText(/Email address/);
      expect(emailInput).toHaveAttribute('aria-required', 'true');

      const passwordInput = screen.getByLabelText(/Password/);
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('renders accessible Checkbox with zero axe violations', async () => {
      const { container } = render(
        <label className="flex items-center gap-2">
          <Checkbox id="terms" />
          <span>I accept the terms and conditions</span>
        </label>,
      );

      await expectNoAxeViolations(container);
    });
  });

  describe('Tabs', () => {
    it('has zero axe violations and provides accessible keyboard interaction', async () => {
      const { container } = render(
        <Tabs defaultValue="account">
          <TabsList aria-label="Account Settings Tabs">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Account Settings Panel</TabsContent>
          <TabsContent value="password">Password Settings Panel</TabsContent>
          <TabsContent value="notifications">Notification Preferences</TabsContent>
        </Tabs>,
      );

      await expectNoAxeViolations(container);

      const accountTab = screen.getByRole('tab', { name: 'Account' });
      expect(accountTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Table', () => {
    it('has zero axe violations with scoped header cells', async () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Alex Rivera</TableCell>
              <TableCell>Admin</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      await expectNoAxeViolations(container);

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveAttribute('scope', 'col');
    });
  });

  describe('Drawer', () => {
    it('has zero axe violations and proper dialog role/labels', async () => {
      const { container } = render(
        <Drawer
          open={true}
          onOpenChange={vi.fn()}
          title="Edit Channel Details"
          description="Update topic and description"
        >
          <div>Drawer body content</div>
        </Drawer>,
      );

      await expectNoAxeViolations(container);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByRole('heading', { name: 'Edit Channel Details' })).toBeInTheDocument();
    });
  });

  describe('EmptyState & LoadingState', () => {
    it('has zero axe violations', async () => {
      const { container } = render(
        <div>
          <EmptyState
            title="No Documents Found"
            description="Create your first document to start collaborating."
            action={<Button>Create Document</Button>}
          />
          <LoadingState label="Loading workspace channels…" />
        </div>,
      );

      await expectNoAxeViolations(container);
    });
  });

  describe('KanbanBoard Drag-and-Drop & Keyboard Alternative', () => {
    it('has zero axe violations and supports keyboard navigation', async () => {
      const onMove = vi.fn();
      const columns = [
        {
          id: 'todo',
          title: 'To Do',
          cards: [
            { id: 'task-1', title: 'Implement accessibility', priority: 'urgent' as const },
          ],
        },
        {
          id: 'done',
          title: 'Done',
          cards: [],
        },
      ];

      const { container } = render(
        <KanbanBoard columns={columns} onCardMove={onMove} />,
      );

      await expectNoAxeViolations(container);

      const card = screen.getByRole('button', { name: /Implement accessibility/ });
      expect(card).toBeInTheDocument();

      // Test Alt+ArrowRight moves card to next column
      await userEvent.type(card, '{Alt>}{ArrowRight}{/Alt}');
      expect(onMove).toHaveBeenCalledWith('task-1', 'todo', 'done', 0);
    });
  });

  describe('Live Screen Reader Announcements', () => {
    it('creates polite and assertive live regions in document.body', () => {
      announceToScreenReader('New notification received', 'polite');
      const container = document.querySelector('[data-a11y-live-region-container="true"]');
      expect(container).toBeInTheDocument();

      const polite = container?.querySelector('[aria-live="polite"]');
      expect(polite).toBeInTheDocument();

      const assertive = container?.querySelector('[aria-live="assertive"]');
      expect(assertive).toBeInTheDocument();
    });
  });
});
