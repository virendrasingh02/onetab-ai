import { beforeEach, describe, expect, it } from 'vitest';
import { useCardRegistryStore } from './card-registry-store.js';

describe('card-registry-store', () => {
  beforeEach(() => {
    useCardRegistryStore.getState().resetToDefaults();
  });

  it('preloads built-in system card templates', () => {
    const state = useCardRegistryStore.getState();
    expect(state.cards['crm-lead']).toBeDefined();
    expect(state.cards['github-pr']).toBeDefined();
    expect(state.cards['approval-request']).toBeDefined();
    expect(state.cards['agent-result']).toBeDefined();
    expect(state.cards['task-card']).toBeDefined();
  });

  it('registers and retrieves a custom card by ID and version', () => {
    const store = useCardRegistryStore.getState();
    const customCard = {
      cardId: 'invoice-demo',
      version: 1,
      name: 'Invoice Demo',
      category: 'finance' as const,
      visibility: 'workspace' as const,
      status: 'draft' as const,
      supportedSurfaces: ['matrix' as const],
      schema: { fields: {} },
      rootComponent: { id: 'root', type: 'container' as const },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.registerCard(customCard);
    const retrieved = useCardRegistryStore.getState().getCard('invoice-demo', 1);
    expect(retrieved?.name).toBe('Invoice Demo');
    expect(retrieved?.version).toBe(1);
  });

  it('publishes a new version increments version number', () => {
    const store = useCardRegistryStore.getState();
    const published = store.publishVersion('crm-lead');
    expect(published?.version).toBe(2);
    expect(published?.status).toBe('published');

    // Both v1 and v2 are preserved in versions history
    const v1 = useCardRegistryStore.getState().getCard('crm-lead', 1);
    const v2 = useCardRegistryStore.getState().getCard('crm-lead', 2);
    expect(v1?.version).toBe(1);
    expect(v2?.version).toBe(2);
  });

  it('duplicates an existing card into an independent draft', () => {
    const store = useCardRegistryStore.getState();
    const duplicate = store.duplicateCard('github-pr', 'My Custom PR');
    expect(duplicate).toBeDefined();
    expect(duplicate?.name).toBe('My Custom PR');
    expect(duplicate?.cardId).not.toBe('github-pr');
    expect(duplicate?.status).toBe('draft');
  });

  it('exports and imports card definition JSON safely', () => {
    const store = useCardRegistryStore.getState();
    const exportedJson = store.exportCardJSON('crm-lead');
    expect(exportedJson).toBeDefined();

    const modified = JSON.parse(exportedJson!);
    modified.cardId = 'imported-crm';
    modified.name = 'Imported CRM';

    const importRes = store.importCardJSON(JSON.stringify(modified));
    expect(importRes.success).toBe(true);
    expect(useCardRegistryStore.getState().cards['imported-crm']?.name).toBe('Imported CRM');
  });
});
