// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentPublicController } from './agent-public.controller.js';

/** Runs the real browser SDK against a stubbed session reply and returns its shadow root. */
async function mountWidget(appearance: Record<string, unknown>, mode = 'floating') {
  const send = vi.fn();
  new AgentPublicController({} as never, {} as never, {} as never).getWidgetSdk({ setHeader: vi.fn(), send } as never);
  const sdk = send.mock.calls[0][0] as string;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      json: async () =>
        url.endsWith('/agent-sessions')
          ? {
              sessionId: 's1',
              sessionToken: 't1',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              deployment: { agentName: 'Taylor', agentRole: 'AI assistant', avatarUrl: null, widgetConfig: { appearance } },
            }
          : [{ id: 'm1', role: 'assistant', content: 'Hello there' }],
    })),
  );

  const script = document.createElement('script');
  script.setAttribute('data-agent-id', `agent_${Math.random().toString(36).slice(2)}`);
  script.setAttribute('data-public-key', 'ot_pub_x');
  script.setAttribute('data-mode', mode);
  document.body.appendChild(script);
  new Function(sdk)();
  await new Promise((r) => setTimeout(r, 20));
  return document.querySelector('[id^="onetab-agent-widget-"]')!.shadowRoot!;
}

describe('embed SDK layouts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('panel: a round launcher that opens the full chat', async () => {
    const root = await mountWidget({ layout: 'panel', disclaimer: 'Chats may be recorded.', privacyPolicyUrl: 'https://example.com/privacy' });
    const launcher = root.querySelector<HTMLButtonElement>('.ot-launcher')!;
    expect(launcher.getAttribute('aria-label')).toBe('Chat with Taylor');
    launcher.click();
    expect(root.querySelector('.ot-panel .ot-title')!.textContent).toBe('Taylor');
    expect(root.querySelector('.ot-subtitle')!.textContent).toBe('AI assistant');
    expect(root.querySelector<HTMLInputElement>('.ot-input')!.placeholder).toBe('Ask Taylor a question');
    expect(root.querySelector('.ot-disclaimer')!.textContent).toContain('Chats may be recorded.');
    expect(root.querySelector<HTMLAnchorElement>('.ot-disclaimer a')!.href).toBe('https://example.com/privacy');
    root.querySelector<HTMLButtonElement>('[aria-label="Close chat"]')!.click();
    expect(root.querySelector('.ot-panel')).toBeNull();
  });

  it('compact: greets with a card whose expand button opens the panel, and stays dismissed', async () => {
    const root = await mountWidget({ layout: 'compact' });
    expect(root.querySelector('.ot-compact')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[aria-label="Expand chat"]')!.click();
    expect(root.querySelector('.ot-panel')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[aria-label="Close chat"]')!.click();
    expect(root.querySelector('.ot-launcher')).not.toBeNull();
    expect(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.startsWith('ot_agent_dismissed_'))!)).toBe('1');
  });

  it('pill: an avatar-and-label launcher', async () => {
    const root = await mountWidget({ layout: 'pill', launcherLabel: 'Voice chat' });
    const pill = root.querySelector<HTMLButtonElement>('.ot-pill')!;
    expect(pill.textContent).toBe('Voice chat');
    expect(pill.querySelector('.ot-avatar svg')).not.toBeNull();
    pill.click();
    expect(root.querySelector('.ot-panel')).not.toBeNull();
  });

  it('inline mode always shows the panel and drops unsafe links', async () => {
    const root = await mountWidget({ layout: 'pill', privacyPolicyUrl: 'javascript:alert(1)', primaryColor: 'red;}*{x:y' }, 'inline');
    expect(root.querySelector('.ot-panel')).not.toBeNull();
    expect(root.querySelector('[aria-label="Close chat"]')).toBeNull();
    expect(root.querySelector('.ot-disclaimer')).toBeNull();
    expect(root.querySelectorAll('style')[1].textContent).toBe('');
  });
});
