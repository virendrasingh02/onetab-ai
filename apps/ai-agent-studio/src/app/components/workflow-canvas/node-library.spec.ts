import { describe, expect, it } from 'vitest';
import { CATALOG_NODES, stepUnsupportedReason } from './node-library.js';

describe('stepUnsupportedReason', () => {
  it('is empty for steps that run and for canvas notes', () => {
    for (const type of ['AGENT', 'IF_ELSE', 'HTTP_REQUEST', 'START', 'APP_CONNECTOR_ACTION', 'STICKY_NOTE', 'widget_renderer']) {
      expect(stepUnsupportedReason(type)).toBeUndefined();
    }
  });

  it('gives the compiler’s reason for steps that can’t run yet', () => {
    expect(stepUnsupportedReason('SWITCH_CASE')).toMatch(/If \/ Else/);
    expect(stepUnsupportedReason('NOT_A_REAL_STEP')).toMatch(/can’t run yet/);
  });

  it('flags only the catalog steps the engine can’t run', () => {
    const flagged = CATALOG_NODES.filter((n) => stepUnsupportedReason(n.type)).map((n) => n.type).sort();
    expect(flagged).toEqual(
      ['AI_GUARDRAIL', 'DATA_MAPPER', 'DOC_RETRIEVAL', 'EMBEDDING_MODEL', 'ESCALATE_HUMAN', 'MODEL_ROUTER', 'RERANKER', 'SLACK_SEND', 'SWITCH_CASE'],
    );
  });
});
