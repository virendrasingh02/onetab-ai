import { describe, expect, it } from 'vitest';
import {
  backoffMs,
  classifyStepError,
  isReadScope,
  missingPermissionMessage,
  nowContext,
  paramsContext,
  readAgentProfile,
  scopeForNode,
} from './run-support.js';

describe('classifyStepError', () => {
  it.each([
    ['Gmail isn’t connected. Connect Gmail in Integrations, then run the agent again.', 'MISSING_CONNECTION', false],
    ['The Gmail connection is expired. Reconnect Gmail in Integrations to continue.', 'CONNECTION_EXPIRED', false],
    ['This agent doesn’t have permission to “Create docs” (docs:write).', 'MISSING_PERMISSION', false],
    ['Request failed with status code 429', 'RATE_LIMITED', true],
    ["Step 'x' timed out after 20000 ms.", 'TIMEOUT', true],
    ['connect ETIMEDOUT 1.2.3.4:443', 'TIMEOUT', true],
    ["The input for 'x' is not valid JSON.", 'INVALID_INPUT', false],
    ["Address '169.254.169.254' is private or reserved.", 'INVALID_INPUT', false],
    ['No project matching “Alpha” in this workspace.', 'NOT_FOUND', false],
    ['Something odd happened', 'TOOL_FAILED', true],
  ])('%s → %s', (message, code, retryable) => {
    const result = classifyStepError(message);
    expect(result.code).toBe(code);
    expect(result.retryable).toBe(retryable);
    expect(result.hint).toBeTruthy();
  });
});

describe('backoffMs', () => {
  it('grows exponentially and caps', () => {
    const zero = () => 0;
    expect(backoffMs(1, 'TIMEOUT', zero)).toBe(750);
    expect(backoffMs(2, 'TIMEOUT', zero)).toBe(1_500);
    expect(backoffMs(10, 'TIMEOUT', zero)).toBe(8_000);
  });

  it('waits longer for rate limits', () => {
    expect(backoffMs(1, 'RATE_LIMITED', () => 0)).toBe(4_000);
    expect(backoffMs(9, 'RATE_LIMITED', () => 0)).toBe(30_000);
  });
});

describe('scopes', () => {
  it('maps nodes to the scope they need', () => {
    expect(scopeForNode('TOOL', { toolName: 'create_doc' })).toBe('docs:write');
    expect(scopeForNode('TOOL', { toolName: 'GMAIL.send_message' }, 'write')).toBe('app:gmail:write');
    expect(scopeForNode('TOOL', { toolName: 'GMAIL.search' }, 'read')).toBe('app:gmail:read');
    expect(scopeForNode('AGENT', {})).toBe('agents:run');
    expect(scopeForNode('HTTP_REQUEST', {})).toBe('app:http:write');
    expect(scopeForNode('LLM', {})).toBeNull();
  });

  it('knows which scopes only read', () => {
    expect(isReadScope('tasks:read')).toBe(true);
    expect(isReadScope('tasks:write')).toBe(false);
    expect(isReadScope('app:gmail:read')).toBe(true);
    expect(isReadScope('app:http:write')).toBe(false);
    expect(isReadScope(null)).toBe(true);
  });

  it('explains a missing permission in words', () => {
    expect(missingPermissionMessage('docs:write')).toMatch(/Create docs.*docs:write.*Grant it/);
  });
});

describe('run context', () => {
  it('describes now in the agent’s zone', () => {
    const now = nowContext(new Date('2026-09-30T20:00:00Z'), 'Asia/Kolkata');
    expect(now).toMatchObject({ date: '2026-10-01', time: '01:30', weekday: 'Thursday', timezone: 'Asia/Kolkata' });
  });

  it('reads profiles and params defensively', () => {
    expect(readAgentProfile(null)).toBeNull();
    expect(readAgentProfile({ version: 2 })).toBeNull();
    const profile = readAgentProfile({ version: 1, steps: [], params: [{ key: 'projectId', value: 'p1' }, { key: 'docId' }] });
    expect(paramsContext(profile)).toEqual({ projectId: 'p1', docId: '' });
  });
});
