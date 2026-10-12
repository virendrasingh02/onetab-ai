import type { StudioCanvasGraph } from '@org/types';
import { describe, expect, it } from 'vitest';
import { reviewWorkflow } from './workflow-review';

const n = (id: string, type: string, config: Record<string, unknown> = {}) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, config },
});
const e = (source: string, target: string, sourceHandle?: string) => ({ id: `${source}-${target}-${sourceHandle ?? ''}`, source, target, sourceHandle });

const problemsOf = (graph: StudioCanvasGraph, id: string) =>
  reviewWorkflow(graph).steps.find((s) => s.id === id)?.problems.map((p) => p.message) ?? [];

describe('reviewWorkflow', () => {
  it('flags a step nothing connects to', () => {
    const graph: StudioCanvasGraph = {
      nodes: [n('start', 'START'), n('out', 'OUTPUT'), n('lonely', 'AI_SUMMARIZER')],
      edges: [e('start', 'out')],
    };
    expect(problemsOf(graph, 'lonely').join(' ')).toMatch(/never runs/);
  });

  it('flags a step whose result goes nowhere', () => {
    const graph: StudioCanvasGraph = {
      nodes: [n('start', 'START'), n('a', 'AI_SUMMARIZER'), n('b', 'AI_TRANSLATOR'), n('out', 'OUTPUT')],
      edges: [e('start', 'a'), e('a', 'out'), e('start', 'b')],
    };
    expect(problemsOf(graph, 'b').join(' ')).toMatch(/goes nowhere/);
    expect(problemsOf(graph, 'a').join(' ')).not.toMatch(/goes nowhere|never reaches/);
  });

  it('flags an If / Else branch with nothing on it', () => {
    const graph: StudioCanvasGraph = {
      nodes: [n('start', 'START'), n('if', 'IF_ELSE', { variable: 'x' }), n('yes', 'AI_SUMMARIZER')],
      edges: [e('start', 'if'), e('if', 'yes', 'true')],
    };
    expect(problemsOf(graph, 'if').join(' ')).toMatch(/“false” branch goes nowhere/);
  });

  it('says when nothing starts the agent', () => {
    const review = reviewWorkflow({ nodes: [n('a', 'AI_SUMMARIZER')], edges: [] });
    expect(review.general.map((p) => p.message).join(' ')).toMatch(/no trigger/);
    expect(review.counts.error).toBeGreaterThan(0);
    expect(review.score).toBeLessThan(100);
  });

  it('does not treat an agent’s plugged-in parts as loose steps', () => {
    const graph: StudioCanvasGraph = {
      nodes: [n('start', 'START'), n('agent', 'AGENT', { instructions: 'Help.', model: 'gpt-4o' }), n('llm', 'AI_CHAT_MODEL'), n('out', 'OUTPUT')],
      edges: [e('start', 'agent'), e('agent', 'out'), e('agent', 'llm', 'llm')],
    };
    expect(problemsOf(graph, 'llm').join(' ')).not.toMatch(/never runs|goes nowhere/);
  });

  it('suggests approval when it sends something', () => {
    const graph: StudioCanvasGraph = {
      nodes: [n('start', 'START'), n('send', 'SLACK_SEND'), n('out', 'OUTPUT')],
      edges: [e('start', 'send'), e('send', 'out')],
    };
    expect(reviewWorkflow(graph).suggestions.map((s) => s.prompt)).toContain('Add human approval before sending');
  });
});
