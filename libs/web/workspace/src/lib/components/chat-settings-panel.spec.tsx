import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { store, resetPreferences } from '@org/common';
import { ChatSettingsPanel } from './chat-settings-panel.js';

describe('ChatSettingsPanel', () => {
  beforeEach(() => {
    store.dispatch(resetPreferences());
  });

  it('renders chat preferences options correctly', () => {
    render(
      <Provider store={store}>
        <ChatSettingsPanel />
      </Provider>,
    );

    expect(screen.getByText('Chat & Messaging')).toBeDefined();
    expect(screen.getByText('Comfy')).toBeDefined();
    expect(screen.getByText('Compact')).toBeDefined();
    expect(screen.getByText('Last Read Message')).toBeDefined();
    expect(screen.getByText('Newest Message')).toBeDefined();
    expect(screen.getByText('Send and view read receipts')).toBeDefined();
  });

  it('switches message density when clicking compact', () => {
    render(
      <Provider store={store}>
        <ChatSettingsPanel />
      </Provider>,
    );

    const compactButton = screen.getByText('Compact');
    fireEvent.click(compactButton);

    const state = store.getState();
    expect(state.preferences.preferences.chat.messageDensity).toBe('compact');
  });

  it('switches open position when clicking newest message', () => {
    render(
      <Provider store={store}>
        <ChatSettingsPanel />
      </Provider>,
    );

    const newestButton = screen.getByText('Newest Message');
    fireEvent.click(newestButton);

    const state = store.getState();
    expect(state.preferences.preferences.chat.openPosition).toBe('newest');
  });
});
