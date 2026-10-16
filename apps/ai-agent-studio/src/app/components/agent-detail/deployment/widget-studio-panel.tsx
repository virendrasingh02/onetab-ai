import { publicAgentApi } from '@org/api-client';
import type { AgentDeploymentView, AgentRunResponseView } from '@org/types';
import { Button, Card, Field, Input, Label, SegmentedControl, Textarea, ToggleGroup, ToggleGroupItem } from '@org/ui';
import { cn } from '@org/utils';
import { AlertCircle, Laptop, Palette, RefreshCw, Send, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../../../router.js';
import { cleanColor, cleanOrigins, readWidgetForm, toWidgetConfig, type WidgetForm } from './widget-config.js';
import { errorMessage, type DeploymentApi } from './use-deployment.js';

const PRESET_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Slate', hex: '#0f172a' },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  needsApproval?: boolean;
  tools?: number;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function WidgetStudioPanel({
  api,
  deployment,
  agentName,
}: {
  api: DeploymentApi;
  deployment: AgentDeploymentView;
  agentName: string;
}) {
  const saved = useMemo(() => readWidgetForm(deployment.widgetConfig), [deployment.widgetConfig]);
  const savedOrigins = deployment.allowedOrigins.join('\n');

  const [form, setForm] = useState<WidgetForm>(saved);
  const [originsText, setOriginsText] = useState(savedOrigins);
  const [promptInput, setPromptInput] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Take the server's copy whenever it changes (a save, or another tab).
  useEffect(() => {
    setForm(saved);
  }, [saved]);
  useEffect(() => {
    setOriginsText(savedOrigins);
  }, [savedOrigins]);

  const origins = cleanOrigins(originsText.split('\n'));
  const dirty = !sameJson(form, saved) || !sameJson(origins, cleanOrigins(deployment.allowedOrigins));
  const patch = (next: Partial<WidgetForm>) => setForm((f) => ({ ...f, ...next }));
  const colorOk = !!cleanColor(form.primaryColor);

  const save = () =>
    api.update.mutate(
      { widgetConfig: toWidgetConfig(form, deployment.widgetConfig), allowedOrigins: origins },
      { onSuccess: () => undefined },
    );

  const addPrompt = () => {
    const text = promptInput.trim();
    if (text && !form.suggestedPrompts.includes(text)) patch({ suggestedPrompts: [...form.suggestedPrompts, text] });
    setPromptInput('');
  };

  /* ------------------------------ live preview ------------------------------ */

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [originBlocked, setOriginBlocked] = useState(false);
  const session = useRef<{ id: string; token: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending]);

  // A different deployment is a different conversation.
  useEffect(() => {
    session.current = null;
    setMessages([]);
  }, [deployment.id]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: message }]);
    setChatInput('');
    setSending(true);
    setOriginBlocked(false);
    try {
      if (!session.current) {
        const init = await publicAgentApi.initSession(deployment.publicKey, { preview: true });
        session.current = { id: init.sessionId, token: init.sessionToken };
      }
      const run: AgentRunResponseView = await publicAgentApi.sendMessage(session.current.id, session.current.token, message);
      setMessages((m) => [
        ...m,
        {
          id: run.runId || `a-${Date.now()}`,
          role: 'assistant',
          text: run.output || (run.error ? `Error: ${run.error}` : 'The agent finished without a reply.'),
          needsApproval: run.status === 'WAITING_FOR_APPROVAL',
          tools: run.toolExecutions?.length,
        },
      ]);
    } catch (err) {
      const msg = errorMessage(err, 'The agent could not answer.');
      if (/origin/i.test(msg)) setOriginBlocked(true);
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', text: msg }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    session.current = null;
    setMessages([]);
    setOriginBlocked(false);
  };

  const brand = cleanColor(form.primaryColor) ?? '#6366f1';
  const initial = (form.title || agentName).charAt(0).toUpperCase();
  const dark = form.theme === 'dark';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Controls */}
      <div className="space-y-5 lg:col-span-5">
        <Card className="space-y-5 p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Palette className="size-4 text-primary" /> Appearance & access
              </h3>
              <p className="text-xs text-muted-foreground">Saved to the deployment and applied by the embed.</p>
            </div>
            {dirty ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">Unsaved changes</span> : null}
          </div>

          <SectionLabel>Branding</SectionLabel>
          <div className="space-y-2">
            <Label htmlFor="ws-color">Brand colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <Button
                  key={c.hex}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={c.name}
                  aria-pressed={brand.toLowerCase() === c.hex}
                  title={c.name}
                  onClick={() => patch({ primaryColor: c.hex })}
                  className={cn('size-7 rounded-full border-2 p-0 transition-transform', brand.toLowerCase() === c.hex ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <Input
                id="ws-color"
                value={form.primaryColor}
                onChange={(e) => patch({ primaryColor: e.target.value })}
                aria-invalid={!colorOk}
                wrapperClassName="w-28"
                className="font-mono text-xs"
              />
            </div>
            {!colorOk ? <p className="text-[11px] text-destructive">Use a hex colour like #6366f1.</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <SegmentedControl
                aria-label="Theme"
                size="sm"
                value={form.theme}
                onChange={(theme) => patch({ theme })}
                options={[
                  { value: 'system', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <SegmentedControl
                aria-label="Position"
                size="sm"
                value={form.position}
                onChange={(position) => patch({ position })}
                options={[
                  { value: 'bottom-right', label: 'Right' },
                  { value: 'bottom-left', label: 'Left' },
                ]}
              />
            </div>
          </div>

          <SectionLabel>Content</SectionLabel>
          <Field label="Title" hint="Defaults to the agent’s name.">
            <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder={agentName} />
          </Field>
          <Field label="Subtitle" hint="Defaults to the agent’s role.">
            <Input value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
          </Field>
          <Field label="Welcome message" hint="The first message in every new conversation.">
            <Textarea rows={2} value={form.welcomeMessage} onChange={(e) => patch({ welcomeMessage: e.target.value })} placeholder="Hi! How can I help?" />
          </Field>

          <div className="space-y-2">
            <Label htmlFor="ws-prompt">Suggested prompts</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.suggestedPrompts.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted py-0.5 pl-2.5 pr-1 text-[11px] text-foreground">
                  {p}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove “${p}”`}
                    className="size-4 rounded-full"
                    onClick={() => patch({ suggestedPrompts: form.suggestedPrompts.filter((x) => x !== p) })}
                  >
                    <X className="size-2.5" />
                  </Button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="ws-prompt"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPrompt();
                  }
                }}
                placeholder="Add a starter question…"
              />
              <Button type="button" variant="outline" size="sm" onClick={addPrompt} disabled={!promptInput.trim()}>
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <SectionLabel>Access &amp; sessions</SectionLabel>
            <Field
              label="Allowed origins"
              hint="One per line, e.g. https://www.example.com. A site not listed can’t start a session. Use * to allow any site."
            >
              <Textarea rows={3} value={originsText} onChange={(e) => setOriginsText(e.target.value)} placeholder="*" className="font-mono text-xs" />
            </Field>
            <Field label="Session length (minutes)" hint="How long a visitor’s conversation stays alive. Up to 30 days.">
              <Input
                type="number"
                min={5}
                max={60 * 24 * 30}
                value={form.sessionDurationMinutes}
                onChange={(e) => patch({ sessionDurationMinutes: Number(e.target.value) || saved.sessionDurationMinutes })}
              />
            </Field>
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={!dirty || api.update.isPending} onClick={() => { setForm(saved); setOriginsText(savedOrigins); }}>
              Reset
            </Button>
            <Button type="button" size="sm" onClick={save} loading={api.update.isPending} disabled={!dirty || !colorOk} className="font-semibold">
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col items-center lg:sticky lg:top-4 lg:col-span-7 lg:self-start">
        <ToggleGroup
          type="single"
          size="sm"
          aria-label="Preview device"
          className="mb-3"
          value={device}
          onValueChange={(v) => v && setDevice(v as 'desktop' | 'mobile')}
        >
          <ToggleGroupItem value="desktop" className="gap-1.5 px-3">
            <Laptop className="size-3.5" /> Desktop
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" className="gap-1.5 px-3">
            <Smartphone className="size-3.5" /> Mobile
          </ToggleGroupItem>
        </ToggleGroup>

        <div
          className={cn(
            'flex h-[min(640px,calc(100vh-16rem))] min-h-[420px] flex-col overflow-hidden rounded-2xl border-2 border-border shadow-xl transition-all duration-300',
            device === 'desktop' ? 'w-[420px]' : 'w-[360px]',
            dark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900',
          )}
          aria-label="Widget preview"
        >
          <div className="flex items-center justify-between p-4 text-white" style={{ backgroundColor: brand }}>
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">{initial}</div>
              <div>
                <div className="text-xs font-bold leading-tight">{form.title || agentName}</div>
                <div className="text-[10px] leading-tight text-white/80">{form.subtitle || 'Online'}</div>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Start a new conversation" title="Start a new conversation" onClick={reset} className="text-white/80 hover:bg-white/10 hover:text-white">
              <RefreshCw className="size-3.5" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs" aria-live="polite">
            <Bubble brand={brand} dark={dark} initial={initial}>
              <p>{form.welcomeMessage || `Hello! I am ${agentName}. How can I assist you today?`}</p>
              {form.suggestedPrompts.length > 0 && messages.length === 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {form.suggestedPrompts.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-auto whitespace-normal rounded-full px-2 py-1 text-left text-[10px] font-normal"
                      onClick={() => void send(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              ) : null}
            </Bubble>

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm px-3 py-2 text-white" style={{ backgroundColor: brand }}>
                    {m.text}
                  </div>
                </div>
              ) : (
                <Bubble key={m.id} brand={brand} dark={dark} initial={initial}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.tools ? <p className="text-[10px] opacity-60">{m.tools} tool call{m.tools === 1 ? '' : 's'}</p> : null}
                  {m.needsApproval ? (
                    <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
                      <div className="flex items-center gap-1 font-bold">
                        <AlertCircle className="size-3.5" /> Waiting for a person to approve
                      </div>
                      <p>
                        This step is paused until it is approved in{' '}
                        <Link to="/approvals" className="underline">
                          Human Approvals
                        </Link>
                        .
                      </p>
                    </div>
                  ) : null}
                </Bubble>
              ),
            )}

            {sending ? (
              <div className="flex items-center gap-2 text-xs italic opacity-70">
                <span className="size-5 animate-pulse rounded-full" style={{ backgroundColor: brand }} />
                Thinking…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {originBlocked ? (
            <div className="space-y-1.5 border-t border-border bg-warning/10 px-3 py-2 text-[11px] text-warning">
              <p>This Studio’s address isn’t in the allowed origins, so a preview session was refused, as it would be for any other site.</p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  const next = cleanOrigins([...origins, window.location.origin]);
                  setOriginsText(next.join('\n'));
                  api.update.mutate({ allowedOrigins: next });
                }}
              >
                Allow {window.location.origin}
              </Button>
            </div>
          ) : null}

          <form
            className={cn('flex items-center gap-2 border-t p-3', dark ? 'border-slate-700 bg-slate-800' : 'border-border bg-slate-50')}
            onSubmit={(e) => {
              e.preventDefault();
              void send(chatInput);
            }}
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Message"
              disabled={sending || deployment.status !== 'ACTIVE'}
              wrapperClassName="flex-1"
              className="text-xs"
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={!chatInput.trim() || sending || deployment.status !== 'ACTIVE'} className="shrink-0 text-white" style={{ backgroundColor: brand }}>
              <Send className="size-3.5" />
            </Button>
          </form>
        </div>
        <p className="mt-3 max-w-[420px] text-center text-[11px] text-muted-foreground">
          The preview chats with the live deployment, exactly as an embed would. It uses real model credits.
        </p>
      </div>
    </div>
  );
}

function Bubble({ brand, dark, initial, children }: { brand: string; dark: boolean; initial: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: brand }}>
        {initial}
      </div>
      <div className={cn('max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm border px-3 py-2', dark ? 'border-slate-700 bg-slate-800' : 'border-border bg-slate-50')}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border/60 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
