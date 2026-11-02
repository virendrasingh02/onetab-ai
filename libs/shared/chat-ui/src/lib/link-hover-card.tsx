import {
  Badge,
  copyToClipboard,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Link2,
  Mail,
  Music,
  ShieldAlert,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { normalizeUrl } from './link-detector.js';
import { useLinkPreviewStore } from './use-link-preview.js';

export type LinkKind =
  | 'link'
  | 'video'
  | 'image'
  | 'audio'
  | 'pdf'
  | 'file'
  | 'meeting'
  | 'email';

const KIND_META: Record<LinkKind, { label: string; icon: LucideIcon }> = {
  link: { label: 'Link', icon: Link2 },
  video: { label: 'Video', icon: Film },
  image: { label: 'Image', icon: ImageIcon },
  audio: { label: 'Audio', icon: Music },
  pdf: { label: 'PDF document', icon: FileText },
  file: { label: 'File', icon: FileIcon },
  meeting: { label: 'Meeting link', icon: Video },
  email: { label: 'Email address', icon: Mail },
};

const EXTENSION_KINDS: Record<string, LinkKind> = {
  mp4: 'video',
  m4v: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  flac: 'audio',
  aac: 'audio',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  svg: 'image',
  pdf: 'pdf',
  zip: 'file',
  csv: 'file',
  txt: 'file',
  doc: 'file',
  docx: 'file',
  xls: 'file',
  xlsx: 'file',
  ppt: 'file',
  pptx: 'file',
};

export interface LinkTarget {
  kind: LinkKind;
  /** Upper-cased extension of a direct file link ("MP4"). */
  fileType?: string;
  /** The origin, shown emphasised so a lookalike domain stands out. */
  host: string;
  /** Everything after the origin, shown muted. */
  rest: string;
  /** What "Copy link" puts on the clipboard. */
  copyValue: string;
  /** Plain `http:` — worth a flag before someone opens it. */
  insecure: boolean;
}

function isMeetingLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'meet.google.com') return true;
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) return url.pathname.startsWith('/j/');
  return host === 'teams.microsoft.com' && url.pathname.startsWith('/l/meetup-join');
}

/**
 * Splits a link's destination into what the hover card shows: the kind of
 * thing it points at (guessed from the address alone — nothing is fetched),
 * the origin, and the rest. `href` is always an address `safeUrl` already
 * vetted (`http(s):` or `mailto:`).
 */
export function describeLinkTarget(href: string): LinkTarget {
  if (/^mailto:/i.test(href)) {
    const raw = href.slice('mailto:'.length).split('?')[0];
    let address = raw;
    try {
      address = decodeURIComponent(raw);
    } catch {
      // keep the raw text
    }
    return { kind: 'email', host: address, rest: '', copyValue: address, insecure: false };
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'link', host: href, rest: '', copyValue: href, insecure: false };
  }

  const bareRoot = url.pathname === '/' && !url.search && !url.hash;
  const extension = /\.([a-z0-9]{2,5})$/i.exec(url.pathname)?.[1]?.toLowerCase();
  const fileKind = extension ? EXTENSION_KINDS[extension] : undefined;

  return {
    kind: fileKind ?? (isMeetingLink(url) ? 'meeting' : 'link'),
    fileType: fileKind ? extension?.toUpperCase() : undefined,
    host: url.host,
    rest: bareRoot ? '' : `${url.pathname}${url.search}${url.hash}`,
    copyValue: href,
    insecure: url.protocol === 'http:',
  };
}

export interface LinkHoverCardProps {
  /** The link's destination — already vetted by the caller. */
  href: string;
  className?: string;
  /** The link's visible label. */
  children: ReactNode;
  /**
   * Also fetch the page's title, description and thumbnail when the card
   * opens. Off where link previews are switched off, so hovering never
   * sends a URL to the server against the user's or workspace's wishes.
   */
  enrich?: boolean;
}

/**
 * A message link that, on hover, shows where it really goes plus quick
 * actions — copy it, open it in a new tab. The anchor itself is unchanged
 * (same href, same new-tab behaviour), so the card is purely additive.
 */
export function LinkHoverCard({ href, className, children, enrich = false }: LinkHoverCardProps) {
  return (
    <HoverCard openDelay={350} closeDelay={120}>
      <HoverCardTrigger asChild>
        <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
          {children}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        data-slot="link-hover-card"
        className="w-80 overflow-hidden rounded-lg p-0"
        // The card is portalled, but React events still bubble through the
        // message that owns the link — don't let a click or right-click here
        // also open its thread, selection, or context menu.
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <LinkHoverBody href={href} enrich={enrich} />
      </HoverCardContent>
    </HoverCard>
  );
}

const ACTION_BUTTON_CLASS =
  'inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Card layout, top to bottom: the page's thumbnail, what the link is (kind,
 * title, description), where it really goes, then labelled actions. Text the
 * unfurl repeats — a site name equal to the title or the domain — is dropped
 * so the card reads once.
 */
function LinkHoverBody({ href, enrich }: { href: string; enrich: boolean }) {
  const target = useMemo(() => describeLinkTarget(href), [href]);
  const normalized = normalizeUrl(href);
  const preview = useLinkPreviewStore((s) => s.previews[normalized]);
  const loading = useLinkPreviewStore((s) => Boolean(s.loadingUrls[normalized]));
  const fetchPreview = useLinkPreviewStore((s) => s.fetchPreview);
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const titleId = useId();

  // The card's content only mounts while it is open, so this is the
  // "on hover" fetch; the store dedupes and caches per URL. Direct file links
  // are skipped — the server only unfurls HTML pages.
  const canUnfurl = enrich && target.kind === 'link';
  useEffect(() => {
    if (canUnfurl) void fetchPreview(href);
  }, [canUnfurl, href, fetchPreview]);

  const rich =
    preview?.status === 'ready' && (preview.title || preview.description || preview.image)
      ? preview
      : undefined;
  const kind: LinkKind =
    target.kind === 'link' &&
    (rich?.mediaType === 'video' || rich?.mediaType === 'audio' || rich?.mediaType === 'image')
      ? rich.mediaType
      : target.kind;
  const { label, icon: KindIcon } = KIND_META[kind];
  const isEmail = kind === 'email';
  const showKind = kind !== 'link';

  const siteName = rich?.siteName?.trim();
  const showSiteName = Boolean(
    siteName &&
      siteName.toLowerCase() !== rich?.title?.trim().toLowerCase() &&
      siteName.toLowerCase() !== target.host.toLowerCase(),
  );
  const favicon = rich?.favicon && !faviconFailed ? rich.favicon : undefined;

  return (
    <div
      role="group"
      aria-labelledby={rich?.title ? titleId : undefined}
      aria-label={rich?.title ? undefined : `${label} details`}
    >
      {rich?.image && !imageFailed ? (
        <img
          src={rich.image}
          alt=""
          loading="lazy"
          className="aspect-[1.91/1] w-full border-b border-border/60 bg-muted object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <div className="space-y-2 px-3 pt-3 pb-2.5">
        {showKind || showSiteName ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {showKind ? (
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">
                <KindIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </span>
            ) : null}
            {target.fileType ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                {target.fileType}
              </Badge>
            ) : null}
            {showKind && showSiteName ? <span aria-hidden="true">·</span> : null}
            {showSiteName ? <span className="truncate">{siteName}</span> : null}
          </div>
        ) : null}

        {rich?.title || rich?.description ? (
          <div className="space-y-1">
            {rich.title ? (
              // Bigger click target for the same destination; keyboard users
              // already have "Open" below, so it stays out of the tab order.
              <a
                id={titleId}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                tabIndex={-1}
                className="line-clamp-2 text-sm leading-snug font-semibold text-foreground hover:underline"
              >
                {rich.title}
              </a>
            ) : null}
            {rich.description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {rich.description}
              </p>
            ) : null}
          </div>
        ) : !rich && canUnfurl && loading ? (
          <div
            role="status"
            aria-label="Loading link preview"
            className="space-y-1.5 motion-safe:animate-pulse"
          >
            <div className="h-3.5 w-3/4 rounded-xs bg-muted" />
            <div className="h-3 w-full rounded-xs bg-muted" />
          </div>
        ) : null}

        <div className="flex items-start gap-2 rounded-md bg-surface-inset/60 px-2 py-1.5">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 rounded-xs object-contain"
              onError={() => setFaviconFailed(true)}
            />
          ) : isEmail ? (
            <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <p
            title={href}
            className="line-clamp-2 min-w-0 text-xs leading-relaxed text-muted-foreground select-text [overflow-wrap:anywhere]"
          >
            <span className="sr-only">{isEmail ? 'Address: ' : 'Goes to: '}</span>
            {/* One unbreakable box, so the origin stays whole and only the path wraps. */}
            <span className="inline-block max-w-full font-medium text-foreground">{target.host}</span>
            {target.rest}
          </p>
        </div>

        {target.insecure ? (
          <p role="note" className="flex items-center gap-1 text-[11px] text-warning-text">
            <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
            Not secure — this link doesn&apos;t use HTTPS
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1 border-t border-border/60 p-1">
        <CopyLinkButton value={target.copyValue} isEmail={isEmail} />
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={isEmail ? 'Compose email' : 'Open link in a new tab'}
          className={ACTION_BUTTON_CLASS}
        >
          {isEmail ? (
            <Mail className="size-3.5" aria-hidden="true" />
          ) : (
            <ExternalLink className="size-3.5" aria-hidden="true" />
          )}
          {isEmail ? 'Compose email' : 'Open link'}
        </a>
      </div>
    </div>
  );
}

function CopyLinkButton({ value, isEmail }: { value: string; isEmail: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      // Toasts "Link copied" itself and throws when the browser refuses.
      await copyToClipboard(value);
    } catch {
      toast.error('Could not copy the link');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? 'Link copied' : undefined}
      className={cn(ACTION_BUTTON_CLASS, copied && 'text-success-text hover:text-success-text')}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? 'Copied' : isEmail ? 'Copy address' : 'Copy link'}
    </button>
  );
}
