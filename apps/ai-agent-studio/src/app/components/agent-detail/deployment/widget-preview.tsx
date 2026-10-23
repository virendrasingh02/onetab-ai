import type { AgentSessionAttachment, AgentWidgetConversation, AgentWidgetLayout } from '@org/types';
import { cn, formatBytes, formatRelative } from '@org/utils';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Maximize2,
  MessageCircle,
  Paperclip,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
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
  attachments?: AgentSessionAttachment[];
}

/** A file picked in the composer, while it uploads and until the message is sent. */
export interface PendingAttachment {
  localId: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
  attachment?: AgentSessionAttachment;
}

/** The visitor's conversation history, as the header's history view draws it. */
export interface WidgetHistory {
  isOpen: boolean;
  toggle: () => void;
  items: AgentWidgetConversation[] | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => void | Promise<void>;
  remove: (id: string) => void | Promise<void>;
}

/** What the composer's file picker offers; the API reads the text out of these. */
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.log,.png,.jpg,.jpeg,.bmp';
/** Files one message can carry (the API's limit). */
export const MAX_MESSAGE_ATTACHMENTS = 5;

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
  allowAttachments: boolean;
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
  onNewChat,
  history,
  attachments,
  onAttach,
  onRemoveAttachment,
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
  onNewChat: () => void;
  history: WidgetHistory;
  attachments: PendingAttachment[];
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (localId: string) => void;
  notice?: ReactNode;
  device: 'desktop' | 'mobile';
}) {
  const [draft, setDraft] = useState('');
  const vars = { ...(look.dark ? DARK : LIGHT), '--ot-brand': look.brand } as CSSProperties;
  const left = look.position === 'bottom-left';
  const uploading = attachments.some((a) => a.status === 'uploading');
  const hasFiles = attachments.some((a) => a.status === 'ready');
  const started = messages.some((m) => m.role === 'user');

  const submit = () => {
    const text = draft.trim();
    if ((!text && !hasFiles) || uploading || sending || disabled) return;
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
      canSubmit={(!!draft.trim() || hasFiles) && !uploading}
      attachments={attachments}
      onAttach={look.allowAttachments ? onAttach : undefined}
      onRemoveAttachment={onRemoveAttachment}
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
              <IconButton
                label={history.isOpen ? 'Back to chat' : 'Conversation history'}
                active={history.isOpen}
                disabled={disabled}
                onClick={history.toggle}
              >
                <History className="size-[17px]" />
              </IconButton>
              <IconButton label="New chat" disabled={disabled || (!started && !history.isOpen)} onClick={onNewChat}>
                <SquarePen className="size-[17px]" />
              </IconButton>
              <IconButton label="Close chat" onClick={() => onViewChange('closed')}>
                <X className="size-[18px]" />
              </IconButton>
            </Header>

            {history.isOpen ? (
              <HistoryList history={history} onNewChat={onNewChat} />
            ) : (
            <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-4 pt-2.5" aria-live="polite">
              <BotText>{look.welcomeMessage}</BotText>
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex max-w-[80%] flex-col items-end gap-1.5 self-end">
                    {m.attachments?.length ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a) => (
                          <FileChip key={a.id} name={a.name} meta={formatBytes(a.size)} />
                        ))}
                      </div>
                    ) : null}
                    {m.text ? (
                      <div className="whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-[15px] leading-[1.55]" style={{ background: 'var(--ot-soft)' }}>
                        {m.text}
                      </div>
                    ) : null}
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
            )}

            {notice}

            {look.suggestedPrompts.length > 0 && !started && !history.isOpen ? (
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

function IconButton({
  label,
  small,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  small?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center justify-center hover:bg-[var(--ot-soft)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent',
        small ? 'size-[22px] rounded-full' : 'size-8 rounded-lg',
        active && 'bg-[var(--ot-soft)]',
      )}
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
  canSubmit,
  attachments,
  onAttach,
  onRemoveAttachment,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  sending: boolean;
  emphasis: boolean;
  canSubmit: boolean;
  attachments: PendingAttachment[];
  /** Absent when the widget doesn't take files. */
  onAttach?: (files: File[]) => void;
  onRemoveAttachment: (localId: string) => void;
}) {
  const ready = canSubmit && !sending && !disabled;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn('rounded-[10px] border-[1.5px] transition-colors', !emphasis && 'focus-within:border-[var(--ot-brand)]')}
      style={{ background: 'var(--ot-bg)', borderColor: emphasis ? 'var(--ot-brand)' : 'var(--ot-line)' }}
      onDragOver={onAttach ? (e) => e.preventDefault() : undefined}
      onDrop={
        onAttach
          ? (e) => {
              e.preventDefault();
              if (!disabled && e.dataTransfer.files.length) onAttach(Array.from(e.dataTransfer.files));
            }
          : undefined
      }
    >
      {attachments.length ? (
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {attachments.map((a) => (
            <FileChip
              key={a.localId}
              name={a.name}
              meta={a.status === 'error' ? (a.error ?? 'Upload failed') : a.status === 'uploading' ? 'Uploading…' : formatBytes(a.size)}
              status={a.status}
              onRemove={() => onRemoveAttachment(a.localId)}
            />
          ))}
        </div>
      ) : null}
      <div className={cn('flex items-center gap-2 py-1.5 pr-1.5', onAttach ? 'pl-1.5' : 'pl-3.5')}>
      {onAttach ? (
        <>
          <button
            type="button"
            aria-label="Attach files"
            title="Attach files"
            disabled={disabled || attachments.length >= MAX_MESSAGE_ATTACHMENTS}
            onClick={() => fileRef.current?.click()}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--ot-soft)] disabled:opacity-40"
            style={{ color: 'var(--ot-muted)' }}
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAttach(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
        </>
      ) : null}
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
    </div>
  );
}

function FileChip({
  name,
  meta,
  status = 'ready',
  onRemove,
}: {
  name: string;
  meta: string;
  status?: PendingAttachment['status'];
  onRemove?: () => void;
}) {
  const failed = status === 'error';
  return (
    <div
      className="flex max-w-[220px] items-center gap-2 rounded-lg border py-1.5 pl-2 pr-1.5 text-left"
      style={{ borderColor: failed ? 'rgba(239,68,68,0.5)' : 'var(--ot-line)', background: 'var(--ot-bg)' }}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ background: 'color-mix(in srgb, var(--ot-brand) 18%, transparent)', color: 'var(--ot-brand)' }}
      >
        {status === 'uploading' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : failed ? (
          <AlertCircle className="size-3.5 text-red-500" />
        ) : (
          <FileText className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-tight">{name}</span>
        <span className={cn('block truncate text-[11px] leading-tight', failed && 'text-red-500')} style={failed ? undefined : { color: 'var(--ot-muted)' }}>
          {meta}
        </span>
      </span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          title="Remove"
          onClick={onRemove}
          className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-[var(--ot-soft)]"
          style={{ color: 'var(--ot-muted)' }}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

function HistoryList({ history, onNewChat }: { history: WidgetHistory; onNewChat: () => void }) {
  // The untouched conversation the visitor is in isn't worth listing.
  const items = (history.items ?? []).filter((c) => !(c.current && c.title === 'New conversation'));
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-5 pb-2 pt-1">
        <button type="button" onClick={history.toggle} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--ot-muted)' }}>
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <span className="flex-1 text-center text-[13px] font-semibold">Conversations</span>
        <button type="button" onClick={onNewChat} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--ot-brand)' }}>
          <SquarePen className="size-3.5" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3" aria-busy={history.loading}>
        {history.error ? <p className="px-2 py-2 text-xs text-red-500">{history.error}</p> : null}
        {history.loading && !items.length ? (
          <div className="space-y-2 px-2 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg" style={{ background: 'var(--ot-soft)' }} />
            ))}
          </div>
        ) : !items.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center" style={{ color: 'var(--ot-muted)' }}>
            <MessageCircle className="size-6" />
            <p className="text-[13px]">No conversations yet. Ask something and it will show up here.</p>
          </div>
        ) : (
          <ul aria-label="Conversations">
            {items.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => void history.select(c.id)}
                  aria-current={c.current || undefined}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 pr-9 text-left transition-colors hover:bg-[var(--ot-soft)]"
                  style={c.current ? { background: 'var(--ot-soft)' } : undefined}
                >
                  <span className="w-full truncate text-[13.5px] font-medium leading-snug">{c.title}</span>
                  <span className="text-[11.5px]" style={{ color: 'var(--ot-muted)' }}>
                    {c.current ? 'Current · ' : ''}
                    {formatRelative(c.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${c.title}`}
                  title="Delete conversation"
                  onClick={() => void history.remove(c.id)}
                  className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-[var(--ot-bg)] focus-visible:opacity-100 group-hover:opacity-100"
                  style={{ color: 'var(--ot-muted)' }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
