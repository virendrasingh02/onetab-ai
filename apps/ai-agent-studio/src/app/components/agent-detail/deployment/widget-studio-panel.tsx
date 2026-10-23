import { publicAgentApi } from '@org/api-client';
import type { AgentDeploymentView, AgentRunResponseView, AgentWidgetLayout } from '@org/types';
import { Button, Card, Field, Input, Label, SegmentedControl, Textarea, ToggleGroup, ToggleGroupItem } from '@org/ui';
import { cn } from '@org/utils';
import { ImageUp, Laptop, Palette, RotateCcw, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BrandColorPicker } from './brand-color-picker.js';
import { cleanAvatarUrl, cleanColor, cleanLinkUrl, cleanOrigins, MAX_AVATAR_BYTES, readWidgetForm, toWidgetConfig, type WidgetForm } from './widget-config.js';
import { Avatar, initialView, WidgetPreview, type ChatMessage, type PreviewView, type WidgetLook } from './widget-preview.js';
import { errorMessage, type DeploymentApi } from './use-deployment.js';

const LAYOUTS: Array<{ value: AgentWidgetLayout; label: string; hint: string }> = [
  { value: 'panel', label: 'Panel', hint: 'Launcher opens the full chat' },
  { value: 'compact', label: 'Compact', hint: 'Greets with a small card that expands' },
  { value: 'pill', label: 'Pill', hint: 'Avatar + label launcher' },
];

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function WidgetStudioPanel({
  api,
  deployment,
  agentName,
  agentAvatarUrl,
  onDirtyChange,
}: {
  api: DeploymentApi;
  deployment: AgentDeploymentView;
  agentName: string;
  agentAvatarUrl?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const saved = useMemo(() => readWidgetForm(deployment.widgetConfig), [deployment.widgetConfig]);
  const savedOrigins = deployment.allowedOrigins.join('\n');

  const [form, setForm] = useState<WidgetForm>(saved);
  const [originsText, setOriginsText] = useState(savedOrigins);
  const [promptInput, setPromptInput] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Take the server's copy whenever it changes (a save, or another tab).
  useEffect(() => {
    setForm(saved);
  }, [saved]);
  useEffect(() => {
    setOriginsText(savedOrigins);
  }, [savedOrigins]);

  const origins = cleanOrigins(originsText.split('\n'));
  const dirty = !sameJson(form, saved) || !sameJson(origins, cleanOrigins(deployment.allowedOrigins));
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const patch = (next: Partial<WidgetForm>) => setForm((f) => ({ ...f, ...next }));
  const colorOk = !!cleanColor(form.primaryColor);
  const avatarOk = !form.avatarUrl.trim() || !!cleanAvatarUrl(form.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const uploadAvatar = (file: File | undefined) => {
    setAvatarError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(file.type)) {
      setAvatarError('Use a PNG, JPG, GIF, WebP or SVG image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Keep the image under 256 KB, or paste a hosted image URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && patch({ avatarUrl: reader.result });
    reader.onerror = () => setAvatarError('That image could not be read.');
    reader.readAsDataURL(file);
  };

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
  const [sending, setSending] = useState(false);
  const [originBlocked, setOriginBlocked] = useState(false);
  const session = useRef<{ id: string; token: string } | null>(null);
  const [view, setView] = useState<PreviewView>(() => initialView(saved.layout));
  // Switching layout shows what a visitor first sees with it.
  useEffect(() => {
    setView(initialView(form.layout));
  }, [form.layout]);

  // A different deployment is a different conversation.
  useEffect(() => {
    session.current = null;
    setMessages([]);
  }, [deployment.id]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: message }]);
    setView('open');
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
  // Same order the API resolves for the embed: the widget's own image, else the agent's.
  const avatarSrc = cleanAvatarUrl(form.avatarUrl) ?? cleanAvatarUrl(agentAvatarUrl);
  const dark = form.theme === 'dark' || (form.theme === 'system' && prefersDark());
  const title = form.title.trim() || agentName;
  const privacyOk = !form.privacyPolicyUrl.trim() || !!cleanLinkUrl(form.privacyPolicyUrl);
  const look: WidgetLook = {
    layout: form.layout,
    title,
    subtitle: form.subtitle.trim(),
    avatarSrc,
    brand,
    dark,
    position: form.position,
    welcomeMessage: form.welcomeMessage.trim() || `Hello! I am ${agentName}. How can I assist you today?`,
    suggestedPrompts: form.suggestedPrompts,
    placeholder: form.inputPlaceholder.trim(),
    launcherLabel: form.launcherLabel.trim(),
    disclaimer: form.disclaimer.trim(),
    privacyUrl: cleanLinkUrl(form.privacyPolicyUrl),
  };

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
            {dirty ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-2xs font-semibold text-warning">Unsaved changes</span> : null}
          </div>

          <SectionLabel>Style</SectionLabel>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Widget style">
            {LAYOUTS.map((l) => {
              const active = form.layout === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patch({ layout: l.value })}
                  className={cn(
                    'group flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-foreground/30 hover:bg-muted/50',
                  )}
                >
                  <LayoutThumb layout={l.value} brand={brand} />
                  <span>
                    <span className="block text-xs font-semibold text-foreground">{l.label}</span>
                    <span className="block text-2xs leading-snug text-muted-foreground">{l.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <SectionLabel>Branding</SectionLabel>
          <BrandColorPicker value={form.primaryColor} onChange={(primaryColor) => patch({ primaryColor })} />

          <div className="space-y-2">
            <Label htmlFor="ws-avatar">Avatar</Label>
            <div className="flex items-center gap-3">
              <span style={{ '--ot-brand': brand } as CSSProperties}>
                <Avatar src={avatarSrc} className="size-10" />
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => avatarFileRef.current?.click()}>
                  <ImageUp className="size-3.5" /> Upload
                </Button>
                {form.avatarUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setAvatarError(null); patch({ avatarUrl: '' }); }}>
                    Use agent avatar
                  </Button>
                ) : null}
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  uploadAvatar(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <Input
              id="ws-avatar"
              value={form.avatarUrl.startsWith('data:') ? '' : form.avatarUrl}
              onChange={(e) => { setAvatarError(null); patch({ avatarUrl: e.target.value }); }}
              placeholder={form.avatarUrl.startsWith('data:') ? 'Uploaded image' : 'https://… or leave empty to use the agent’s avatar'}
              aria-invalid={!avatarOk}
              className="text-xs"
            />
            {avatarError || !avatarOk ? (
              <p className="text-xs text-destructive">{avatarError ?? 'Use an https:// image URL.'}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {form.avatarUrl ? 'Shown in the widget header and on the launcher.' : agentAvatarUrl ? 'Using the agent’s avatar.' : 'The agent has no avatar yet, so a bot icon is shown. Upload one to put your brand in the widget.'}
              </p>
            )}
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
          <Field label="Subtitle" hint="Shown under the title, e.g. “AI assistant”.">
            <Input value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="AI assistant" />
          </Field>
          {form.layout === 'pill' ? (
            <Field label="Launcher label" hint="The text on the pill.">
              <Input value={form.launcherLabel} onChange={(e) => patch({ launcherLabel: e.target.value })} placeholder={`Chat with ${title}`} />
            </Field>
          ) : null}
          <Field label="Input placeholder">
            <Input value={form.inputPlaceholder} onChange={(e) => patch({ inputPlaceholder: e.target.value })} placeholder={`Ask ${title} a question`} />
          </Field>
          <Field label="Welcome message" hint="The first message in every new conversation.">
            <Textarea rows={2} value={form.welcomeMessage} onChange={(e) => patch({ welcomeMessage: e.target.value })} placeholder="Hi! How can I help?" />
          </Field>

          <div className="space-y-2">
            <Label htmlFor="ws-prompt">Suggested prompts</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.suggestedPrompts.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted py-0.5 pl-2.5 pr-1 text-xs text-foreground">
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

          <Field label="Disclaimer" hint="Small print under the input, e.g. a recording or data-use notice.">
            <Textarea
              rows={2}
              value={form.disclaimer}
              onChange={(e) => patch({ disclaimer: e.target.value })}
              placeholder="By messaging, you agree that this chat may be monitored and recorded per our"
            />
          </Field>
          <Field label="Privacy policy link" hint="Shown as “Privacy Policy” at the end of the disclaimer.">
            <Input
              type="url"
              value={form.privacyPolicyUrl}
              onChange={(e) => patch({ privacyPolicyUrl: e.target.value })}
              placeholder="https://www.example.com/privacy"
              aria-invalid={!privacyOk}
            />
          </Field>
          {!privacyOk ? <p className="-mt-3 text-xs text-destructive">Use a full https:// link.</p> : null}

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
            <Button type="button" size="sm" onClick={save} loading={api.update.isPending} disabled={!dirty || !colorOk || !avatarOk || !privacyOk} className="font-semibold">
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:col-span-7 lg:self-start">
        <div className="flex w-full max-w-[560px] flex-wrap items-center justify-between gap-2">
          <ToggleGroup type="single" size="sm" aria-label="Preview device" value={device} onValueChange={(v) => v && setDevice(v as 'desktop' | 'mobile')}>
            <ToggleGroupItem value="desktop" className="gap-1.5 px-3">
              <Laptop className="size-3.5" /> Desktop
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" className="gap-1.5 px-3">
              <Smartphone className="size-3.5" /> Mobile
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <SegmentedControl
              aria-label="Preview state"
              size="sm"
              value={view === 'compact' && form.layout !== 'compact' ? 'closed' : view}
              onChange={setView}
              options={[
                { value: 'closed', label: 'Launcher' },
                ...(form.layout === 'compact' ? [{ value: 'compact' as const, label: 'Card' }] : []),
                { value: 'open', label: 'Open' },
              ]}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Start a new conversation" title="Start a new conversation" onClick={reset} disabled={!messages.length}>
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>

        <WidgetPreview
          look={look}
          view={view}
          onViewChange={setView}
          messages={messages}
          sending={sending}
          disabled={deployment.status !== 'ACTIVE'}
          onSend={(text) => void send(text)}
          device={device}
          notice={
            originBlocked ? (
              <div className="mx-5 mb-2.5 space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
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
            ) : null
          }
        />
        <p className="max-w-[560px] text-center text-xs text-muted-foreground">
          The preview chats with the live deployment, exactly as an embed would. It uses real model credits.
          {deployment.status !== 'ACTIVE' ? ' Chat is off while the deployment isn’t active.' : ''}
        </p>
      </div>
    </div>
  );
}

const prefersDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** A tiny drawing of each layout for the style picker. */
function LayoutThumb({ layout, brand }: { layout: AgentWidgetLayout; brand: string }) {
  const line = (w: string) => <span className="block h-1 rounded-full bg-muted-foreground/25" style={{ width: w }} />;
  return (
    <span className="relative block h-16 overflow-hidden rounded-lg border border-border/60 bg-muted/60" aria-hidden>
      {layout === 'panel' ? (
        <span className="absolute bottom-1.5 right-1.5 top-1.5 flex w-[58%] flex-col gap-1 rounded-md border border-border/60 bg-background p-1.5 shadow-sm">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: brand }} />
            {line('50%')}
          </span>
          {line('85%')}
          <span className="block h-1.5 w-[45%] self-end rounded-md bg-muted-foreground/20" />
          <span className="mt-auto block h-2 rounded-md border" style={{ borderColor: brand }} />
        </span>
      ) : layout === 'compact' ? (
        <span className="absolute bottom-1.5 right-1.5 flex w-[62%] flex-col gap-1 rounded-md border border-border/60 bg-background p-1.5 shadow-sm">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: brand }} />
            {line('50%')}
          </span>
          <span className="block h-2 rounded-md border border-border" />
          {line('70%')}
        </span>
      ) : (
        <span className="absolute bottom-2 right-1.5 flex items-center gap-1 rounded-full border border-border/60 bg-background py-0.5 pl-0.5 pr-2 shadow-sm">
          <span className="size-3 rounded-full" style={{ background: brand }} />
          {line('18px')}
        </span>
      )}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border/60 pb-1 text-2xs font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
