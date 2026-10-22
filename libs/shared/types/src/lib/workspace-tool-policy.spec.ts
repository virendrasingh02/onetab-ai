import { describe, expect, it } from 'vitest';
import { agentToolGate, readAgentRuntime } from './agent-config.js';
import { resolveWorkspacePolicy } from './workspace-policies.js';
import {
  applyWorkspaceToolPolicy,
  resolveWorkspaceToolPolicy,
  workspaceToolMode,
} from './workspace-tool-policy.js';

const rt = (raw: Record<string, unknown> = { autonomy: 'autonomous' }) => readAgentRuntime({ runtime: raw });

describe('resolveWorkspaceToolPolicy', () => {
  it('drops malformed and default entries and upper-cases connector keys', () => {
    const policy = resolveWorkspaceToolPolicy({
      connectors: { slack: 'disabled', github: 'allow', gmail: 'nope' },
      tools: { create_task: 'approval', '': 'disabled', search_docs: 7 },
    });
    expect(policy).toEqual({ connectors: { SLACK: 'disabled' }, tools: { create_task: 'approval' } });
  });

  it('tolerates junk', () => {
    expect(resolveWorkspaceToolPolicy(null)).toEqual({ connectors: {}, tools: {} });
    expect(resolveWorkspaceToolPolicy('x')).toEqual({ connectors: {}, tools: {} });
    expect(resolveWorkspaceToolPolicy({ tools: [] })).toEqual({ connectors: {}, tools: {} });
  });

  it('is carried by the workspace policy', () => {
    const resolved = resolveWorkspacePolicy({ toolPolicy: { tools: { create_task: 'disabled' } } });
    expect(resolved.toolPolicy?.tools).toEqual({ create_task: 'disabled' });
    expect(resolveWorkspacePolicy({}).toolPolicy).toEqual({ connectors: {}, tools: {} });
  });
});

describe('workspaceToolMode', () => {
  const policy = resolveWorkspaceToolPolicy({ connectors: { SLACK: 'disabled' }, tools: { slack_list_channels: 'allow', slack_send: 'approval' } });

  it('lets a tool rule win over its app rule', () => {
    expect(workspaceToolMode(policy, 'slack_send', 'SLACK')).toBe('approval');
    expect(workspaceToolMode(policy, 'slack_post', 'SLACK')).toBe('disabled');
  });

  it('allows what no rule mentions', () => {
    expect(workspaceToolMode(policy, 'search_docs')).toBe('allow');
    expect(workspaceToolMode(undefined, 'anything', 'SLACK')).toBe('allow');
  });
});

describe('applyWorkspaceToolPolicy', () => {
  const policy = resolveWorkspaceToolPolicy({ connectors: { SLACK: 'disabled' }, tools: { create_task: 'approval' } });
  const tools = [{ name: 'create_task' }, { name: 'search_docs' }, { name: 'slack_post', connector: 'SLACK' }];

  it('blocks disabled tools and queues approval ones, whatever the agent allows', () => {
    const { runtime, disabled } = applyWorkspaceToolPolicy(
      rt({ autonomy: 'autonomous', rules: { policies: { create_task: 'auto_allow', slack_post: 'auto_allow' } } }),
      policy,
      tools,
    );
    expect(agentToolGate(runtime, 'slack_post', false)).toBe('blocked');
    expect(agentToolGate(runtime, 'create_task', false)).toBe('approval');
    expect(agentToolGate(runtime, 'search_docs', true)).toBe('allow');
    expect([...disabled]).toEqual(['slack_post']);
  });

  it('never loosens an agent that already blocked the tool', () => {
    const { runtime } = applyWorkspaceToolPolicy(rt({ rules: { policies: { create_task: 'blocked' } } }), policy, tools);
    expect(agentToolGate(runtime, 'create_task', false)).toBe('blocked');
  });

  it('returns the runtime untouched when the workspace has no rules', () => {
    const base = rt();
    const result = applyWorkspaceToolPolicy(base, { connectors: {}, tools: {} }, tools);
    expect(result.runtime).toBe(base);
    expect(result.disabled.size).toBe(0);
  });
});
