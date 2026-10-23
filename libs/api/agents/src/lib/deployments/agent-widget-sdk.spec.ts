// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentPublicController } from './agent-public.controller.js';

/** Runs the real browser SDK against a stubbed session reply and returns its shadow root. */
async function mountWidget(appearance: Record<string, unknown>, mode = 'floating', behavior: Record<string, unknown> = {}) {
  const send = vi.fn();
  new AgentPublicController({} as never, {} as never, {} as never).getWidgetSdk({ setHeader: vi.fn(), send } as never);
  const sdk = send.mock.calls[0][0] as string;

  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith('/agent-sessions')
        ? {
            sessionId: 's1',
            sessionToken: 't1',
            visitorKey: VISITOR,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            deployment: { agentName: 'Taylor', agentRole: 'AI assistant', avatarUrl: null, widgetConfig: { appearance, behavior } },
          }
        : url.endsWith('/conversations')
          ? [
              { id: 's1', title: 'New conversation', updatedAt: new Date().toISOString(), current: true },
              { id: 's0', title: 'Return policy for damaged items', updatedAt: new Date().toISOString(), current: false },
            ]
          : [{ id: 'm1', role: 'assistant', content: 'Hello there' }],
  }));
  vi.stubGlobal('fetch', fetchMock);

  const script = document.createElement('script');
  script.setAttribute('data-agent-id', `agent_${Math.random().toString(36).slice(2)}`);
  script.setAttribute('data-public-key', 'ot_pub_x');
  script.setAttribute('data-mode', mode);
  document.body.appendChild(script);
  new Function(sdk)();
  await new Promise((r) => setTimeout(r, 20));
  const root = document.querySelector('[id^="onetab-agent-widget-"]')!.shadowRoot!;
  return Object.assign(root, { fetchMock });
}

const VISITOR = `ot_vis_${'a'.repeat(48)}`;

describe('embed SDK conversations and files', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('remembers the visitor and resumes their last conversation', async () => {
    localStorage.setItem('ot_agent_visitor_ot_pub_x', VISITOR);
    localStorage.setItem('ot_agent_session_ot_pub_x', 's_prev');
    const root = await mountWidget({}, 'inline');
    const init = JSON.parse(root.fetchMock.mock.calls[0][1].body);
    expect(init).toMatchObject({ visitorKey: VISITOR, resumeSessionId: 's_prev' });
    expect(localStorage.getItem('ot_agent_session_ot_pub_x')).toBe('s1');
  });

  it('has history and new-chat actions, and lists earlier conversations', async () => {
    const root = await mountWidget({}, 'inline');
    expect(root.querySelector<HTMLButtonElement>('[aria-label="New chat"]')!.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[aria-label="Conversation history"]')!.click();
    await new Promise((r) => setTimeout(r, 20));
    const names = [...root.querySelectorAll('.ot-history-name')].map((n) => n.textContent);
    // The untouched current conversation is left out.
    expect(names).toEqual(['Return policy for damaged items']);
    expect(root.querySelector('[aria-label="Delete Return policy for damaged items"]')).not.toBeNull();
  });

  it('offers a file picker unless the deployment turned uploads off', async () => {
    const on = await mountWidget({}, 'inline');
    expect(on.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toContain('.pdf');
    document.body.innerHTML = '';
    const off = await mountWidget({}, 'inline', { allowAttachments: false });
    expect(off.querySelector('.ot-attach')).toBeNull();
  });
});

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
  it('calls the API it was served from, fills the inline container, and works as a module script', async () => {
    const send = vi.fn();
    new AgentPublicController({} as never, {} as never, {} as never).getWidgetSdk({ setHeader: vi.fn(), send } as never);
    const sdk = send.mock.calls[0][0] as string;
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sessionId: 's1', sessionToken: 't1', deployment: {} }) }));
    vi.stubGlobal('fetch', fetchMock);

    document.body.innerHTML = '<div id="onetab-agent-container"></div>';
    const script = document.createElement('script');
    script.src = 'https://api.example.com/v2/deployments/sdk/agent-widget.js?x=1';
    script.setAttribute('data-agent-id', 'agent_inline');
    script.setAttribute('data-public-key', 'ot_pub_x');
    script.setAttribute('data-mode', 'inline');
    document.body.appendChild(script);
    new Function(sdk)(); // jsdom has no currentScript here, like a module script

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v2/agent-sessions');
    expect(document.querySelector('#onetab-agent-container #onetab-agent-widget-agent_inline')).not.toBeNull();
  });
});
