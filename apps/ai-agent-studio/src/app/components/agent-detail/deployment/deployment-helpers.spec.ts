import { describe, expect, it } from 'vitest';
import { buildSnippets } from './snippets.js';
import { DEFAULT_WIDGET_FORM, cleanColor, cleanOrigins, readWidgetForm, toWidgetConfig } from './widget-config.js';

describe('buildSnippets', () => {
  const input = { apiBase: 'https://api.example.com/api/v1/', agentId: 'agent_1', publicKey: 'ot_pub_abc' };

  it('points every snippet at the API the deployment actually lives on', () => {
    const s = buildSnippets(input);
    expect(s.widget).toContain('src="https://api.example.com/api/v1/deployments/sdk/agent-widget.js"');
    expect(s.widget).toContain('data-agent-id="agent_1"');
    expect(s.widget).toContain('data-public-key="ot_pub_abc"');
    expect(s.iframe).toContain('/deployments/sdk/agent-embed.html?agentId=agent_1&publicKey=ot_pub_abc');
    expect(s.curl).toContain('https://api.example.com/api/v1/agents/agent_1/execute');
    expect(s.webComponent).toContain('<onetab-agent');
  });

  it('never leaks the public key into server-side snippets, which use an API key', () => {
    const s = buildSnippets(input);
    for (const id of ['curl', 'node', 'python', 'headless'] as const) {
      expect(s[id]).not.toContain('ot_pub_abc');
    }
    expect(s.curl).toContain('Authorization: Bearer YOUR_AGENT_API_KEY');
  });

  it('reads the response fields the API really returns', () => {
    const s = buildSnippets(input);
    expect(s.node).toContain('run.output');
    expect(s.python).toContain('run["output"]');
    expect(s.node).not.toContain('run.result');
  });

  it('keeps the curl body valid shell: no stray apostrophe inside the single-quoted JSON', () => {
    const body = buildSnippets(input).curl.split("-d '")[1] ?? '';
    expect(body.slice(0, body.lastIndexOf("'"))).not.toContain("'");
  });

  it('leaves theming to the saved widget config, except the iframe which needs a background up front', () => {
    const s = buildSnippets({ ...input, theme: 'light' });
    for (const id of ['widget', 'inline', 'webComponent', 'react'] as const) expect(s[id]).not.toContain('theme');
    expect(s.iframe).toContain('&theme=light');
    expect(buildSnippets({ ...input, theme: 'system' }).iframe).not.toContain('theme=');
  });
});

describe('widget config mapping', () => {
  it('reads the nested shape the API and SDK use', () => {
    const form = readWidgetForm({
      appearance: { title: 'Help', primaryColor: '#112233', theme: 'light', position: 'bottom-left', suggestedPrompts: ['Hi', ''] },
      behavior: { sessionDurationMinutes: 60 },
    });
    expect(form).toMatchObject({
      title: 'Help',
      primaryColor: '#112233',
      theme: 'light',
      position: 'bottom-left',
      suggestedPrompts: ['Hi'],
      sessionDurationMinutes: 60,
    });
  });

  it('still reads flat keys older saves used, and prefers nested ones', () => {
    const form = readWidgetForm({ title: 'Old', primaryColor: '#abc', appearance: { title: 'New' } } as never);
    expect(form.title).toBe('New');
    expect(form.primaryColor).toBe('#abc');
  });

  it('ignores values it cannot use instead of passing them to the SDK', () => {
    const form = readWidgetForm({ appearance: { theme: 'neon', position: 'center', primaryColor: 'url(javascript:x)' } } as never);
    expect(form.theme).toBe(DEFAULT_WIDGET_FORM.theme);
    expect(form.position).toBe(DEFAULT_WIDGET_FORM.position);
    expect(form.primaryColor).toBe(DEFAULT_WIDGET_FORM.primaryColor);
    expect(cleanColor('red; background:url(x)')).toBeUndefined();
  });

  it('writes the nested shape and keeps unrelated saved keys', () => {
    const saved = toWidgetConfig(
      { ...DEFAULT_WIDGET_FORM, title: ' Support ', welcomeMessage: 'Hello', suggestedPrompts: [' Pricing ', ''] },
      { appearance: { avatarUrl: 'https://x/y.png' }, custom: 1 } as never,
    ) as Record<string, any>;
    expect(saved.appearance).toMatchObject({ title: 'Support', welcomeMessage: 'Hello', suggestedPrompts: ['Pricing'], avatarUrl: 'https://x/y.png' });
    expect(saved.behavior.sessionDurationMinutes).toBe(DEFAULT_WIDGET_FORM.sessionDurationMinutes);
    expect(saved.custom).toBe(1);
  });

  it('round-trips a form', () => {
    const form = { ...DEFAULT_WIDGET_FORM, title: 'A', subtitle: 'B', suggestedPrompts: ['x', 'y'], position: 'bottom-left' as const };
    expect(readWidgetForm(toWidgetConfig(form, undefined))).toEqual(form);
  });

  it('cleans origins', () => {
    expect(cleanOrigins([' https://a.com/ ', 'https://a.com', '', '*'])).toEqual(['https://a.com', '*']);
  });
});
