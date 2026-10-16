import type { IntegrationCapabilities } from '@org/types';
import { cardsFromProviders, catalogueSection } from './IntegrationHubView.js';

const provider = (
  over: Partial<IntegrationCapabilities> & Pick<IntegrationCapabilities, 'provider' | 'displayName'>,
): IntegrationCapabilities => ({
  description: '',
  category: '',
  authType: 'OAUTH2',
  supportsSync: false,
  supportsWebhooks: false,
  supportsMessaging: false,
  supportsCustomEndpoints: false,
  ...over,
});

describe('cardsFromProviders', () => {
  it('makes one connectable card per registered provider, sorted by name', () => {
    const cards = cardsFromProviders([
      provider({ provider: 'STRIPE', displayName: 'Stripe', connectorCategory: 'finance' }),
      provider({ provider: 'JIRA', displayName: 'Jira', category: 'Project management' }),
    ]);

    expect(cards.map((c) => c.id)).toEqual(['jira', 'stripe']);
    expect(cards.every((c) => c.supported)).toBe(true);
    expect(cards[0].category).toBe('project_management');
    expect(cards[1].category).toBe('finance');
    expect(cards[0].capabilities?.provider).toBe('JIRA');
  });

  it('marks internal apps and skips workspace-defined custom connectors', () => {
    const cards = cardsFromProviders([
      provider({ provider: 'ONETAB_INTERNAL', displayName: 'Onetab', connectorCategory: 'internal' }),
      provider({ provider: 'CUSTOM_ORDERS_1A2B3C4D', displayName: 'Orders API' }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0].isInternal).toBe(true);
  });

  it('returns nothing while the providers are still loading', () => {
    expect(cardsFromProviders(undefined)).toEqual([]);
  });
});

describe('catalogueSection', () => {
  const [github] = cardsFromProviders([provider({ provider: 'GITHUB', displayName: 'GitHub' })]);
  const comingSoon = { ...github, id: 'figma', supported: false, capabilities: undefined };

  it('puts a linked app under Connected even if its OAuth app lost its credentials', () => {
    expect(catalogueSection(github, { linked: true, needsSetup: true })).toBe('connected');
  });

  it('sends an OAuth app without credentials to Needs setup instead of offering Connect', () => {
    expect(catalogueSection(github, { linked: false, needsSetup: true })).toBe('setup');
    expect(catalogueSection(github, { linked: false, needsSetup: false })).toBe('ready');
  });

  it('keeps unsupported apps under Coming soon', () => {
    expect(catalogueSection(comingSoon, { linked: false, needsSetup: false })).toBe('soon');
  });
});
