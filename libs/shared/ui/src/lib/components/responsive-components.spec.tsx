import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AdaptiveLayout } from './adaptive-layout.js';
import { ResizablePanelLayout, ResizablePanels } from './resizable-panels.js';
import { ResponsiveNavigation } from './responsive-navigation.js';
import {
  computeOverflowLayout,
  ResponsiveOverflow,
} from './responsive-overflow.js';
import { ResponsiveTabs, ResponsiveTabsList } from './responsive-tabs.js';
import { ResponsiveToolbar } from './responsive-toolbar.js';
import { Tabs, TabsContent, TabsTrigger } from './tabs.js';

describe('Responsive Components Suite', () => {
  describe('ResponsiveOverflow', () => {
    it('renders all items when space is unconstrained', () => {
      const items = [
        { id: '1', label: 'About' },
        { id: '2', label: 'Members' },
        { id: '3', label: 'Coworkers' },
      ];

      render(<ResponsiveOverflow items={items} />);

      expect(screen.getAllByText('About').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Members').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Coworkers').length).toBeGreaterThan(0);
    });

    it('supports maxVisibleItems constraint and renders More dropdown', async () => {
      const user = userEvent.setup();
      const onAboutClick = vi.fn();
      const onAgentsClick = vi.fn();

      const items = [
        { id: '1', label: 'About', onClick: onAboutClick },
        { id: '2', label: 'Members' },
        { id: '3', label: 'Coworkers' },
        { id: '4', label: 'Agents & apps', onClick: onAgentsClick },
      ];

      render(
        <ResponsiveOverflow
          items={items}
          maxVisibleItems={2}
          overflowLabel="More"
        />,
      );

      // About and Members should be visible in main row
      expect(screen.getAllByText('About').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Members').length).toBeGreaterThan(0);

      // Overflow button should be present
      const moreBtn = screen.getByRole('button', { name: /More items/i });
      expect(moreBtn).toBeInTheDocument();

      // Click More to open dropdown
      await user.click(moreBtn);

      // Coworkers and Agents & apps should be visible in dropdown
      expect(screen.getByRole('menuitem', { name: /Coworkers/i })).toBeInTheDocument();
      const agentsItem = screen.getByRole('menuitem', { name: /Agents & apps/i });
      expect(agentsItem).toBeInTheDocument();

      // Click item in dropdown
      await user.click(agentsItem);
      expect(onAgentsClick).toHaveBeenCalledTimes(1);
    });

    it('marks More trigger active when active item is inside overflow', () => {
      const items = [
        { id: 'about', label: 'About' },
        { id: 'members', label: 'Members' },
        { id: 'coworkers', label: 'Coworkers' },
      ];

      render(
        <ResponsiveOverflow
          items={items}
          maxVisibleItems={1}
          isItemActive={(item) => item.id === 'coworkers'}
        />,
      );

      const moreTrigger = screen.getByRole('button', { name: /More items/i });
      expect(moreTrigger).toHaveAttribute('data-state', 'active');
    });
  });

  describe('ResponsiveTabs & ResponsiveTabsList', () => {
    it('renders ResponsiveTabs with full tab switching and active states', async () => {
      const user = userEvent.setup();

      function TestTabComponent() {
        const [active, setActive] = useState('about');
        return (
          <ResponsiveTabs
            value={active}
            onValueChange={setActive}
            items={[
              { value: 'about', label: 'About' },
              { value: 'members', label: 'Members', count: 5 },
              { value: 'coworkers', label: 'Coworkers', count: 2 },
              { value: 'apps', label: 'Agents & apps' },
              { value: 'automations', label: 'Automations' },
            ]}
          >
            <TabsContent value="about">About details</TabsContent>
            <TabsContent value="members">Members list</TabsContent>
            <TabsContent value="apps">Apps catalog</TabsContent>
          </ResponsiveTabs>
        );
      }

      render(<TestTabComponent />);

      expect(screen.getByText('About details')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
      expect(screen.getAllByText('5').length).toBeGreaterThan(0);

      // Switch to Members tab
      const membersTab = screen.getByRole('tab', { name: /Members/i });
      await user.click(membersTab);

      expect(await screen.findByText('Members list')).toBeInTheDocument();
      expect(screen.queryByText('About details')).not.toBeInTheDocument();
    });

    it('supports ResponsiveTabsList with maxVisibleItems and switches tabs from More menu', async () => {
      const user = userEvent.setup();

      function TestTabListWithOverflow() {
        const [active, setActive] = useState('about');
        return (
          <Tabs value={active} onValueChange={setActive}>
            <ResponsiveTabsList
              maxVisibleItems={2}
              keepActiveVisible={false}
              items={[
                { value: 'about', label: 'About' },
                { value: 'members', label: 'Members' },
                { value: 'coworkers', label: 'Coworkers' },
                { value: 'apps', label: 'Agents & apps' },
              ]}
            />
            <TabsContent value="about">About content</TabsContent>
            <TabsContent value="apps">Agents and Apps content</TabsContent>
          </Tabs>
        );
      }

      render(<TestTabListWithOverflow />);

      expect(screen.getByText('About content')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'About' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();

      // Open More tabs menu
      const moreBtn = screen.getByRole('button', { name: /More tabs/i });
      await user.click(moreBtn);

      const appsMenuItem = screen.getByRole('menuitem', { name: /Agents & apps/i });
      await user.click(appsMenuItem);

      // Now active tab is 'apps'
      expect(await screen.findByText('Agents and Apps content')).toBeInTheDocument();
      expect(screen.queryByText('About content')).not.toBeInTheDocument();

      // The More button should reflect the active tab
      expect(screen.getByRole('button', { name: /More tabs/i })).toHaveAttribute(
        'data-state',
        'active',
      );
    });

    it('keeps the selected tab visible by default, swapping out the last visible tab', async () => {
      const user = userEvent.setup();

      function Harness() {
        const [active, setActive] = useState('about');
        return (
          <Tabs value={active} onValueChange={setActive}>
            <ResponsiveTabsList
              maxVisibleItems={2}
              items={[
                { value: 'about', label: 'About' },
                { value: 'members', label: 'Members' },
                { value: 'coworkers', label: 'Coworkers' },
                { value: 'apps', label: 'Agents & apps' },
              ]}
            />
          </Tabs>
        );
      }

      render(<Harness />);
      await user.click(screen.getByRole('button', { name: /More tabs/i }));
      await user.click(screen.getByRole('menuitem', { name: /Agents & apps/i }));

      const selected = screen.getByRole('tab', { name: 'Agents & apps' });
      expect(selected).toHaveAttribute('data-state', 'active');
      expect(screen.queryByRole('tab', { name: 'Members' })).toBeNull();
      expect(screen.getByRole('button', { name: /More tabs/i })).toHaveAttribute(
        'data-state',
        'inactive',
      );
    });

    it('switches an uncontrolled <Tabs defaultValue> from the More menu', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="node">
          <ResponsiveTabsList maxVisibleItems={1} keepActiveVisible={false}>
            <TabsTrigger value="node">Node</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
          </ResponsiveTabsList>
          <TabsContent value="node">Node panel</TabsContent>
          <TabsContent value="issues">Issues panel</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText('Node panel')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /More tabs/i }));
      await user.click(screen.getByRole('menuitem', { name: /Issues/i }));

      expect(await screen.findByText('Issues panel')).toBeInTheDocument();
      expect(screen.queryByText('Node panel')).not.toBeInTheDocument();
    });

    it('keeps trigger classes from <TabsTrigger> children and renders each tab exactly once', () => {
      render(
        <Tabs defaultValue="all">
          <ResponsiveTabsList>
            <TabsTrigger value="all" className="h-6 px-2.5">
              All
            </TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </ResponsiveTabsList>
        </Tabs>,
      );

      // The off-screen measuring copies must not be real (focusable) tabs.
      expect(screen.getAllByRole('tab')).toHaveLength(2);
      expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(screen.getByRole('tab', { name: 'All' })).toHaveClass('h-6', 'px-2.5');
    });
  });

  describe('computeOverflowLayout', () => {
    const widths = [60, 80, 100, 70];

    it('shows everything when it fits', () => {
      expect(
        computeOverflowLayout({
          containerWidth: 400,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
        }),
      ).toEqual({ visible: [0, 1, 2, 3], overflow: [] });
    });

    it('reserves room for the More trigger once anything overflows', () => {
      // 60 + 4 + 80 = 144 fits in 250 - 70 - 4 = 176; adding 100 would not.
      expect(
        computeOverflowLayout({
          containerWidth: 250,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
        }),
      ).toEqual({ visible: [0, 1], overflow: [2, 3] });
    });

    it('treats an exact fit as a fit despite sub-pixel rounding', () => {
      expect(
        computeOverflowLayout({
          containerWidth: 60 + 4 + 80 + 4 + 100 + 4 + 70 - 0.3,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
        }).overflow,
      ).toEqual([]);
    });

    it('swaps the active item in when asked, dropping as many trailing items as needed', () => {
      expect(
        computeOverflowLayout({
          containerWidth: 250,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
          activeIndex: 2,
          keepActiveVisible: true,
        }),
        // 60 + 4 + 100 = 164 fits in 176; 60 + 4 + 80 + 4 + 100 would not.
      ).toEqual({ visible: [0, 2], overflow: [1, 3] });
    });

    it('honours min / max visible counts', () => {
      expect(
        computeOverflowLayout({
          containerWidth: 10,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
          minVisibleItems: 1,
        }).visible,
      ).toEqual([0]);
      expect(
        computeOverflowLayout({
          containerWidth: 1000,
          itemWidths: widths,
          moreWidth: 70,
          gap: 4,
          maxVisibleItems: 2,
        }).visible,
      ).toEqual([0, 1]);
    });

    it('shows every item until measured, unless capped', () => {
      expect(
        computeOverflowLayout({
          containerWidth: 0,
          itemWidths: [0, 0, 0],
          moreWidth: 0,
          gap: 4,
        }).visible,
      ).toEqual([0, 1, 2]);
    });
  });

  describe('ResponsiveToolbar', () => {
    it('renders toolbar buttons and handles clicks', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onExport = vi.fn();

      render(
        <ResponsiveToolbar
          items={[
            { id: 'save', label: 'Save', onClick: onSave },
            { id: 'export', label: 'Export', onClick: onExport },
          ]}
        />,
      );

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: 'Save' });
      await user.click(saveBtn);
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('moves overflow actions into More dropdown when limited', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();

      render(
        <ResponsiveToolbar
          maxVisibleItems={1}
          items={[
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete', onClick: onDelete },
          ]}
        />,
      );

      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      const moreBtn = screen.getByRole('button', { name: /More actions/i });
      await user.click(moreBtn);

      const deleteMenuItem = screen.getByRole('menuitem', { name: /Delete/i });
      await user.click(deleteMenuItem);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('ResponsiveNavigation', () => {
    it('renders nav elements with aria-current on active item', () => {
      render(
        <ResponsiveNavigation
          items={[
            { id: 'home', label: 'Home', active: true },
            { id: 'projects', label: 'Projects' },
          ]}
        />,
      );

      const homeBtn = screen.getByRole('button', { name: 'Home' });
      expect(homeBtn).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('ResizablePanels & ResizablePanelLayout', () => {
    it('renders resize handle with ARIA attributes and responds to keyboard resize', () => {
      const onSizesChange = vi.fn();
      render(
        <ResizablePanels
          defaultSizes={[50, 50]}
          minSizes={[20, 20]}
          leftOrTop={<div>Left Pane</div>}
          rightOrBottom={<div>Right Pane</div>}
          onSizesChange={onSizesChange}
        />,
      );

      const handle = screen.getByRole('separator');
      // Side-by-side panes are split by a vertical divider.
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
      expect(handle).toHaveAttribute('aria-valuenow', '50');

      // Test keyboard step: ArrowLeft
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(onSizesChange).toHaveBeenCalledWith([48, 52]);

      // Test keyboard step: ArrowRight
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(onSizesChange).toHaveBeenCalledWith([50, 50]);

      // Test keyboard step with shift: Shift + ArrowLeft
      fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
      expect(onSizesChange).toHaveBeenCalledWith([40, 60]);

      // Test Home (minimum)
      fireEvent.keyDown(handle, { key: 'Home' });
      expect(onSizesChange).toHaveBeenCalledWith([20, 80]);

      // Test End (maximum)
      fireEvent.keyDown(handle, { key: 'End' });
      expect(onSizesChange).toHaveBeenCalledWith([80, 20]);

      // Test Enter (reset)
      fireEvent.keyDown(handle, { key: 'Enter' });
      expect(onSizesChange).toHaveBeenCalledWith([50, 50]);
    });

    it('aliases ResizablePanelLayout correctly', () => {
      expect(ResizablePanelLayout).toBe(ResizablePanels);
    });
  });

  describe('AdaptiveLayout', () => {
    it('renders sidebar, content, and aside', () => {
      render(
        <AdaptiveLayout
          sidebar={<div>My Sidebar</div>}
          content={<div>My Content</div>}
          aside={<div>My Aside</div>}
        />,
      );

      expect(screen.getByText('My Sidebar')).toBeInTheDocument();
      expect(screen.getByText('My Content')).toBeInTheDocument();
      expect(screen.getByText('My Aside')).toBeInTheDocument();
    });
  });
});
