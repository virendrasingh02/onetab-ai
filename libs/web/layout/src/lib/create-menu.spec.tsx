// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@org/ui';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SidebarFooterActions } from './create-menu.js';

describe('SidebarFooterActions', () => {
  it('renders expanded footer with Invite members button, customizer, and create trigger', () => {
    const handleOpenInvite = vi.fn();
    const handleCreateChannel = vi.fn();
    const handleOpenCustomizer = vi.fn();

    render(
      <TooltipProvider>
        <MemoryRouter>
          <SidebarFooterActions
            workspaceSlug="acme"
            onCreateChannel={handleCreateChannel}
            onOpenInvite={handleOpenInvite}
            onOpenCustomizer={handleOpenCustomizer}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    const inviteBtn = screen.getByRole('button', { name: /invite members/i });
    expect(inviteBtn).toBeInTheDocument();
    fireEvent.click(inviteBtn);
    expect(handleOpenInvite).toHaveBeenCalled();

    const customizerBtn = screen.getByRole('button', { name: /customize sidebar/i });
    expect(customizerBtn).toBeInTheDocument();
    fireEvent.click(customizerBtn);
    expect(handleOpenCustomizer).toHaveBeenCalled();

    const createBtn = screen.getByRole('button', { name: /create new item/i });
    expect(createBtn).toBeInTheDocument();
  });

  it('triggers invite on keydown "i"', () => {
    const handleOpenInvite = vi.fn();
    render(
      <TooltipProvider>
        <MemoryRouter>
          <SidebarFooterActions
            workspaceSlug="acme"
            onCreateChannel={vi.fn()}
            onOpenInvite={handleOpenInvite}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    fireEvent.keyDown(window, { key: 'i' });
    expect(handleOpenInvite).toHaveBeenCalled();
  });

  it('renders collapsed footer with compact icon buttons and tooltips', () => {
    const handleOpenInvite = vi.fn();
    const handleCreateChannel = vi.fn();

    render(
      <TooltipProvider>
        <MemoryRouter>
          <SidebarFooterActions
            workspaceSlug="acme"
            onCreateChannel={handleCreateChannel}
            onOpenInvite={handleOpenInvite}
            isCollapsed={true}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    const inviteBtn = screen.getByRole('button', { name: /invite members/i });
    expect(inviteBtn).toBeInTheDocument();
    fireEvent.click(inviteBtn);
    expect(handleOpenInvite).toHaveBeenCalled();

    const createBtn = screen.getByRole('button', { name: /create new item/i });
    expect(createBtn).toBeInTheDocument();
  });
});
