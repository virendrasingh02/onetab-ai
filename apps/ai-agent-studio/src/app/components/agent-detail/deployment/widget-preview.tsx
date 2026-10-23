import type { AgentWidgetLayout } from '@org/types';
import { cn } from '@org/utils';
import { AlertCircle, ArrowRight, Bot, ExternalLink, Maximize2, MessageCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from '../../../router.js';

/**
 * Widget Studio's live preview. It draws the same markup and styles as the
 * embed SDK (`getWidgetStyles` in agent-public.controller.ts), so what is seen
 * here is what a visitor gets: change one, change the other.
 */

export type PreviewView = 'closed' | 'compact' | 'open';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  needsApproval?: boolean;
  tools?: number;
}

export interface WidgetLook {
  layout: AgentWidgetLayout;
  title: string;
  subtitle: string;
  avatarSrc?: string;
  brand: string;
  dark: boolean;
  position: 'bottom-right' | 'bottom-left';
  welcomeMessage: string;
  suggestedPrompts: string[];
  placeholder: string;
  launcherLabel: string;
  disclaimer: string;
  privacyUrl?: string;
}

/** The view a visitor first sees for each layout. */
export const initialView = (layout: AgentWidgetLayout): PreviewView =>
  layout === 'compact' ? 'compact' : layout === 'pill' ? 'closed' : 'open';

const LIGHT = {
  '--ot-bg': '#ffffff',
  '--ot-fg': '#1f2937',
  '--ot-muted': '#6b7280',
  '--ot-soft': '#f3f4f6',
  '--ot-line': '#e5e7eb',
  '--ot-shadow': '0 12px 40px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06)',
};
const DARK = {
  '--ot-bg': '#16181d',
  '--ot-fg': '#e5e7eb',
  '--ot-muted': '#9ca3af',
  '--ot-soft': '#262a33',
  '--ot-line': '#2c313b',
  '--ot-shadow': '0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
};

export function WidgetPreview({
  look,
  view,
  onViewChange,
  messages,
  sending,
  disabled,
  onSend,
  notice,
  device,
}: {
  look: WidgetLook;
  view: PreviewView;
  onViewChange: (view: PreviewView) => void;
  messages: ChatMessage[];
  sending: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  notice?: ReactNode;
  device: 'desktop' | 'mobile';
}) {
  const [draft, setDraft] = useState('');
  const vars = { ...(look.dark ? DARK : LIGHT), '--ot-brand': look.brand } as CSSProperties;
  const left = look.position === 'bottom-left';

  const submit = () => {
    const text = draft.trim();
    if (!text || sending || disabled) return;
    setDraft('');
    if (view === 'compact') onViewChange('open');
    onSend(text);
  };

  const composer = (
    <Composer
      draft={draft}
      onDraft={setDraft}
      onSubmit={submit}
      placeholder={look.placeholder || `Ask ${look.title} a question`}
      disabled={disabled}
      sending={sending}
      emphasis={view === 'open'}
    />
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-muted/40 transition-[width] duration-300',
        '[background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:16px_16px]',
        device === 'desktop' ? 'w-full max-w-[560px]' : 'w-[380px] max-w-full',
      )}
      style={{ height: 'min(700px, calc(100vh - 14rem))', minHeight: 520 }}
      aria-label="Widget preview"
    >
      <div
        className={cn('absolute bottom-4 flex flex-col font-sans text-sm leading-normal', left ? 'left-4 items-start' : 'right-4 items-end')}
        style={{ ...vars, color: 'var(--ot-fg)', maxWidth: 'calc(100% - 2rem)', maxHeight: 'calc(100% - 2rem)' }}
      >
        {view === 'open' ? (
          <Card className="flex w-[400px] max-w-full flex-col overflow-hidden" style={{ height: 'min(640px, calc(100vh - 16rem))', maxHeight: '100%', minHeight: 460 }}>
            <Header look={look}>
              <IconButton label="Close chat" onClick={() => onViewChange('closed')}>
                <X className="size-[18px]" />
              </IconButton>
            </Header>

            <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-4 pt-2.5" aria-live="polite">
              <BotText>{look.welcomeMessage}</BotText>
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="max-w-[80%] self-end whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-[15px] leading-[1.55]" style={{ background: 'var(--ot-soft)' }}>
                    {m.text}
                  </div>
                ) : (
                  <div key={m.id}>
                    <BotText>{m.text}</BotText>
                    {m.tools ? <p className="mt-1 text-xs" style={{ color: 'var(--ot-muted)' }}>{m.tools} tool call{m.tools === 1 ? '' : 's'}</p> : null}
                    {m.needsApproval ? (
                      <div className="mt-2.5 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-amber-600">
                          <AlertCircle className="size-3.5" /> Waiting for approval
                        </div>
                        <p style={{ color: 'var(--ot-muted)' }}>
                          Paused until it is approved in{' '}
                          <Link to="/approvals" className="underline">
                            Human Approvals
                          </Link>
                          .
                        </p>
                      </div>
                    ) : null}
                  </div>
                ),
              )}
              {sending ? (
                <div className="flex gap-1 py-1.5" aria-label="Thinking">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full" style={{ background: 'var(--ot-muted)', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              ) : null}
              <ScrollAnchor deps={[messages.length, sending]} />
            </div>

            {notice}

            {look.suggestedPrompts.length > 0 && !messages.some((m) => m.role === 'user') ? (
              <div className="flex flex-wrap gap-2 px-5 pb-2.5">
                {look.suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={disabled || sending}
                    onClick={() => onSend(p)}
                    className="rounded-full px-2.5 py-[5px] text-sm leading-tight transition-colors disabled:opacity-60"
                    style={{
                      color: look.dark ? 'color-mix(in srgb, var(--ot-brand) 55%, #fff)' : 'var(--ot-brand)',
                      background: `color-mix(in srgb, var(--ot-brand) ${look.dark ? 22 : 12}%, transparent)`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={cn('mx-5', !hasNote(look) && 'mb-4')}>{composer}</div>
            <Disclaimer look={look} className="mx-5 mb-4 mt-2.5" />
          </Card>
        ) : view === 'compact' ? (
          <Card className="relative w-[320px] max-w-full px-3.5 pb-3.5 pt-5">
            <div className="absolute -top-[13px] right-3 flex gap-0.5 rounded-full border px-1 py-0.5" style={{ background: 'var(--ot-bg)', borderColor: 'var(--ot-line)' }}>
              <IconButton small label="Expand chat" onClick={() => onViewChange('open')}>
                <Maximize2 className="size-[13px]" />
              </IconButton>
              <IconButton small label="Dismiss" onClick={() => onViewChange('closed')}>
                <X className="size-[13px]" />
              </IconButton>
            </div>
            <Header look={look} compact />
            {composer}
            <Disclaimer look={look} className="mx-1 mt-2.5" />
          </Card>
        ) : look.layout === 'pill' ? (
          <button
            type="button"
            onClick={() => onViewChange('open')}
            className="flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-5 text-[15px] font-medium transition-transform hover:-translate-y-px"
            style={{ background: 'var(--ot-bg)', borderColor: 'var(--ot-line)', boxShadow: 'var(--ot-shadow)', color: 'var(--ot-fg)' }}
          >
            <Avatar src={look.avatarSrc} className="size-9" />
            {look.launcherLabel || `Chat with ${look.title}`}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Chat with ${look.title}`}
            onClick={() => onViewChange('open')}
            className="flex size-14 items-center justify-center overflow-hidden rounded-full text-white transition-transform hover:-translate-y-px"
            style={{ background: 'var(--ot-brand)', boxShadow: 'var(--ot-shadow)' }}
          >
            {look.avatarSrc ? <Avatar src={look.avatarSrc} className="size-full" fallback={<MessageCircle className="size-6" />} /> : <MessageCircle className="size-6" />}
          </button>
        )}
      </div>
    </div>
  );
}

const hasNote = (look: WidgetLook) => !!(look.disclaimer || look.privacyUrl);

function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      role="dialog"
      className={cn('animate-in fade-in-0 slide-in-from-bottom-2 rounded-xl border duration-200', className)}
      style={{ background: 'var(--ot-bg)', borderColor: 'var(--ot-line)', boxShadow: 'var(--ot-shadow)', ...style }}
    >
      {children}
    </div>
  );
}

function Header({ look, compact, children }: { look: WidgetLook; compact?: boolean; children?: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-3', compact ? 'px-0.5 pb-3.5' : 'pb-2.5 pl-5 pr-4 pt-[18px]')}>
      <Avatar src={look.avatarSrc} className="size-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{look.title}</div>
        {look.subtitle ? (
          <div className="truncate text-sm leading-tight" style={{ color: 'var(--ot-muted)' }}>
            {look.subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** The avatar image, or a bot glyph (as the embed draws) when there is none or it fails to load. */
export function Avatar({ src, className, fallback }: { src?: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white', className)} style={{ background: 'var(--ot-brand)' }}>
      {src && failed !== src ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        (fallback ?? <Bot className="size-[60%]" aria-hidden />)
      )}
    </span>
  );
}

function IconButton({ label, small, onClick, children }: { label: string; small?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('inline-flex items-center justify-center hover:bg-[var(--ot-soft)]', small ? 'size-[22px] rounded-full' : 'size-8 rounded-lg')}
      style={{ color: small ? 'var(--ot-muted)' : 'var(--ot-fg)' }}
    >
      {children}
    </button>
  );
}

function BotText({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.55]">{children}</div>;
}

function Composer({
  draft,
  onDraft,
  onSubmit,
  placeholder,
  disabled,
  sending,
  emphasis,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  sending: boolean;
  emphasis: boolean;
}) {
  const ready = !!draft.trim() && !sending && !disabled;
  return (
    <div
      className={cn('flex items-center gap-2 rounded-[10px] border-[1.5px] py-1.5 pl-3.5 pr-1.5 transition-colors', !emphasis && 'focus-within:border-[var(--ot-brand)]')}
      style={{ background: 'var(--ot-bg)', borderColor: emphasis ? 'var(--ot-brand)' : 'var(--ot-line)' }}
    >
      <input
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label="Message"
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent py-[7px] text-[15px] outline-none placeholder:text-[var(--ot-muted)] disabled:cursor-not-allowed"
        style={{ color: 'var(--ot-fg)' }}
      />
      <button
        type="button"
        aria-label="Send"
        disabled={!ready}
        onClick={onSubmit}
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full transition-colors"
        style={ready ? { background: 'var(--ot-brand)', color: '#fff' } : { background: 'var(--ot-soft)', color: 'var(--ot-muted)' }}
      >
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function Disclaimer({ look, className }: { look: WidgetLook; className?: string }) {
  if (!hasNote(look)) return null;
  return (
    <p className={cn('text-center text-[11.5px] leading-normal', className)} style={{ color: 'var(--ot-muted)' }}>
      {look.disclaimer ? `${look.disclaimer} ` : null}
      {look.privacyUrl ? (
        <a href={look.privacyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-[3px] underline">
          Privacy Policy <ExternalLink className="size-[11px]" />
        </a>
      ) : null}
    </p>
  );
}

function ScrollAnchor({ deps }: { deps: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div ref={ref} />;
}
