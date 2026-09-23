import { describe, expect, it } from 'vitest';
import { sanitizeSummary } from './call-summary.service.js';

describe('sanitizeSummary', () => {
  it('coerces sloppy model output into storable values', () => {
    const summary = sanitizeSummary({
      overview: '  Shipped the release plan.  ',
      keyPoints: ['Scope agreed', 42, '', null],
      decisions: ['Go live Friday', { text: 'Freeze on Thursday', timestamp: '75' }],
      actionItems: [
        { title: 'Write notes', priority: 'high', assignee: 'Ana', timestamp: 12.6 },
        { title: 'Tidy backlog', priority: 'CRITICAL' },
        { description: 'no title — dropped' },
      ],
      importantLinks: [
        { title: 'Spec', url: 'https://example.com/spec' },
        { title: 'Nope', url: 'javascript:alert(1)' },
      ],
    });

    expect(summary.overview).toBe('Shipped the release plan.');
    expect(summary.keyPoints).toEqual(['Scope agreed']);
    expect(summary.decisions).toEqual([
      { text: 'Go live Friday', speaker: undefined, timestamp: undefined },
      { text: 'Freeze on Thursday', speaker: undefined, timestamp: 75 },
    ]);
    expect(summary.actionItems).toHaveLength(2);
    expect(summary.actionItems[0]).toMatchObject({
      title: 'Write notes',
      priority: 'HIGH',
      assignee: 'Ana',
      timestamp: 13,
    });
    // An unknown priority falls back instead of failing the whole summary.
    expect(summary.actionItems[1].priority).toBe('MEDIUM');
    expect(summary.importantLinks).toEqual([
      { title: 'Spec', url: 'https://example.com/spec' },
    ]);
  });

  it('turns garbage into an empty summary rather than throwing', () => {
    const summary = sanitizeSummary('not an object');
    expect(summary).toEqual({
      overview: '',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      openQuestions: [],
      followUps: [],
      importantLinks: [],
    });
  });
});
