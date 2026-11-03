import { describe, expect, it } from 'vitest';
import { changesPaidModelSettings } from './ai-entities.service.js';

const SAVED = {
  provider: 'nvidia',
  model: 'nvidia/nemotron',
  configuration: {
    status: 'draft',
    runtime: { temperature: 0.7, maxTokens: 1024 },
  },
};

describe('changesPaidModelSettings', () => {
  it('lets status-only updates through (trash, archive, restore)', () => {
    expect(
      changesPaidModelSettings(
        { configuration: { status: 'deleted', deletedAt: 'now' } },
        SAVED,
      ),
    ).toBe(false);
    expect(
      changesPaidModelSettings(
        { configuration: { ...SAVED.configuration, status: 'archived' } },
        SAVED,
      ),
    ).toBe(false);
  });

  it('ignores the saved model being sent back unchanged', () => {
    expect(
      changesPaidModelSettings(
        { provider: 'nvidia', model: 'nvidia/nemotron' },
        SAVED,
      ),
    ).toBe(false);
  });

  it('flags a new provider or model', () => {
    expect(changesPaidModelSettings({ model: 'gpt-4o' }, SAVED)).toBe(true);
    expect(changesPaidModelSettings({ provider: 'openai' }, SAVED)).toBe(true);
  });

  it('flags changed sampling settings', () => {
    expect(
      changesPaidModelSettings(
        { configuration: { runtime: { temperature: 0.2 } } },
        SAVED,
      ),
    ).toBe(true);
    expect(
      changesPaidModelSettings(
        { configuration: { runtime: { maxTokens: 4096 } } },
        SAVED,
      ),
    ).toBe(true);
  });
});
