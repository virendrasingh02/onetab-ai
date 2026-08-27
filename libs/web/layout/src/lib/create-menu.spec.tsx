// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@org/ui';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SidebarFooterActions } from './create-menu.js';

describe('SidebarFooterActions', () => {
  it('renders expanded footer with New chat button and trigger', () => {
    const handleNewChat = vi.fn();
    const handleCreateChannel = vi.fn();
    const handleOpenCustomizer = vi.fn();

    render(
      <TooltipProvider>
        <MemoryRouter>
          <SidebarFooterActions
            workspaceSlug="acme"
            onCreateChannel={handleCreateChannel}
            onNewChat={handleNewChat}
            onOpenCustomizer={handleOpenCustomizer}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    expect(newChatBtn).toBeInTheDocument();
    fireEvent.click(newChatBtn);
    expect(handleNewChat).toHaveBeenCalled();

    const createBtn = screen.getByRole('button', { name: /create new item/i });
    expect(createBtn).toBeInTheDocument();
  });

  it('renders collapsed footer with compact icon buttons and tooltips', () => {
    const handleNewChat = vi.fn();
    const handleCreateChannel = vi.fn();

    render(
      <TooltipProvider>
        <MemoryRouter>
          <SidebarFooterActions
            workspaceSlug="acme"
            onCreateChannel={handleCreateChannel}
            onNewChat={handleNewChat}
            isCollapsed={true}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    expect(newChatBtn).toBeInTheDocument();
    fireEvent.click(newChatBtn);
    expect(handleNewChat).toHaveBeenCalled();

    const createBtn = screen.getByRole('button', { name: /create new item/i });
    expect(createBtn).toBeInTheDocument();
  });
});

