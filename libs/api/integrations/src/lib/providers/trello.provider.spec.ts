import { describe, expect, it } from 'vitest';
import { TrelloProvider } from './trello.provider.js';

describe('TrelloProvider', () => {
  const provider = new TrelloProvider();

  it('exposes accurate Trello capabilities as a manual API-key/token connector', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('TRELLO');
    expect(caps.authType).toBe('API_KEY_QUERY');
    // Trello has no OAuth2 code-exchange endpoints on the adapter.
    expect(provider.getAuthorizationUrl).toBeUndefined();
    expect(provider.handleCallback).toBeUndefined();
  });

  it('refuses to test a connection with a missing key or token, without calling the network', async () => {
    const result = await provider.testConnection({ apiKey: '', token: '' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/API key and a token/);
  });

  it('gates create_card, update_card, and add_comment behind confirmation, leaves reads free', () => {
    const actions = provider.getActions();
    for (const id of ['create_card', 'update_card', 'add_comment']) {
      expect(actions.find((a) => a.id === id)?.requiresConfirmation).toBe(true);
    }
    for (const id of ['list_boards', 'list_cards', 'list_overdue_cards', 'search']) {
      expect(actions.find((a) => a.id === id)?.requiresConfirmation).toBe(false);
    }
  });
});
