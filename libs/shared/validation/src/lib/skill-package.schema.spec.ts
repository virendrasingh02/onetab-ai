import { describe, expect, it } from 'vitest';
import { validateSkillPackage } from './skill-package.schema.js';

describe('SkillPackageSchema', () => {
  it('validates a minimal valid skill package', () => {
    const raw = {
      schemaVersion: 1,
      id: 'yt-script',
      name: 'YouTube Scriptwriter',
      description: 'Generates scored YouTube scripts based on 21 hook formulas.',
      version: '1.0.0',
      category: 'social_media',
      executionType: 'instruction',
      instructions: '# YouTube Scriptwriting Instructions\n\nFollow 21 hook formulas...',
    };

    const res = validateSkillPackage(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.manifest.id).toBe('yt-script');
      expect(res.manifest.category).toBe('social_media');
      expect(res.manifest.executionType).toBe('instruction');
      expect(res.manifest.author.name).toBe('Community');
    }
  });

  it('rejects an invalid skill id', () => {
    const raw = {
      schemaVersion: 1,
      id: 'Invalid ID with spaces and CAPITAL letters!',
      name: 'Test',
      description: 'Desc',
      version: '1.0.0',
    };

    const res = validateSkillPackage(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes('id:'))).toBe(true);
    }
  });

  it('validates full skill package with inputs, outputs, parameters, and templates', () => {
    const raw = {
      schemaVersion: 1,
      id: 'yt-hookscore',
      name: 'Hook Score Evaluator',
      description: 'Scores hooks against retention markers.',
      version: '1.2.0',
      category: 'social_media',
      executionType: 'script',
      instructions: 'Run hook evaluation',
      inputs: {
        hookText: {
          name: 'hookText',
          type: 'string',
          description: 'First 15 seconds opening text',
          required: true,
        },
      },
      outputs: {
        score: {
          name: 'score',
          type: 'number',
          description: 'Retention score from 0-100',
        },
      },
      parameters: {
        strictMode: {
          key: 'strictMode',
          label: 'Strict Scoring',
          type: 'boolean',
          required: false,
          defaultValue: false,
        },
      },
      permissions: [
        {
          scope: 'script:eval',
          label: 'Script Evaluation',
          description: 'Runs hook scoring script in sandbox',
          sensitive: false,
        },
      ],
      templates: {
        'voice.md': 'Always speak concisely.',
      },
      scripts: {
        'hookscore.js': 'module.exports = { score: (t) => t.length > 10 ? 85 : 40 };',
      },
    };

    const res = validateSkillPackage(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.manifest.inputs['hookText']?.required).toBe(true);
      expect(res.manifest.templates?.['voice.md']).toBeDefined();
    }
  });
});
