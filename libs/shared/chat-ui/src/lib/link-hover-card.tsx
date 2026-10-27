import type { LinkPreview } from '@org/types';
import {
  Badge,
  copyToClipboard,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Hint,
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
        className="w-80 overflow-hidden p-0"
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

const ICON_BUTTON_CLASS =
  'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function LinkHoverBody({ href, enrich }: { href: string; enrich: boolean }) {
  const target = useMemo(() => describeLinkTarget(href), [href]);
  const normalized = normalizeUrl(href);
  const preview = useLinkPreviewStore((s) => s.previews[normalized]);
  const loading = useLinkPreviewStore((s) => Boolean(s.loadingUrls[normalized]));
  const fetchPreview = useLinkPreviewStore((s) => s.fetchPreview);

  // The card's content only mounts while it is open, so this is the
  // "on hover" fetch; the store dedupes and caches per URL. Direct file links
  // are skipped — the server only unfurls HTML pages.
  const canUnfurl = enrich && target.kind === 'link';
  useEffect(() => {
    if (canUnfurl) void fetchPreview(href);
  }, [canUnfurl, href, fetchPreview]);

  const rich = preview?.status === 'ready' ? preview : undefined;
  const kind: LinkKind =
    target.kind === 'link' &&
    (rich?.mediaType === 'video' || rich?.mediaType === 'audio' || rich?.mediaType === 'image')
      ? rich.mediaType
      : target.kind;
  const { label, icon: KindIcon } = KIND_META[kind];

  return (
    <>
      <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
        <KindIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {target.fileType ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
            {target.fileType}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center">
          <CopyLinkButton value={target.copyValue} />
          <Hint label={kind === 'email' ? 'Compose email' : 'Open in new tab'}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={kind === 'email' ? 'Compose email' : 'Open link in a new tab'}
              className={ICON_BUTTON_CLASS}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Hint>
        </div>
      </div>

      {rich ? (
        <RichPreview preview={rich} />
      ) : canUnfurl && loading ? (
        <div
          role="status"
          aria-label="Loading link preview"
          className="animate-pulse space-y-1.5 border-t border-border/60 px-3 py-2.5"
        >
          <div className="h-3 w-3/4 rounded-xs bg-muted" />
          <div className="h-3 w-full rounded-xs bg-muted" />
        </div>
      ) : null}

      <div className="border-t border-border/60 bg-surface-inset/50 px-3 py-2">
        <p
          title={href}
          className="line-clamp-4 text-xs leading-relaxed text-muted-foreground select-text [overflow-wrap:anywhere]"
        >
          {/* One unbreakable box, so the origin stays whole and only the path wraps. */}
          <span className="inline-block max-w-full font-medium text-foreground">{target.host}</span>
          {target.rest}
        </p>
        {target.insecure ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning-text">
            <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
            Not secure — this link doesn&apos;t use HTTPS
          </p>
        ) : null}
      </div>
    </>
  );
}

function CopyLinkButton({ value }: { value: string }) {
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
    <Hint label={copied ? 'Copied' : 'Copy link'}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        className={cn(ICON_BUTTON_CLASS, copied && 'text-success-text')}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </Hint>
  );
}

/** The page's own title / description / thumbnail, when the unfurl found them. */
function RichPreview({ preview }: { preview: LinkPreview }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const { title, description, image, favicon, siteName, domain } = preview;

  if (!title && !description && !image) return null;

  return (
    <div className="space-y-1 border-t border-border/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {favicon && !faviconFailed ? (
          <img
            src={favicon}
            alt=""
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-xs object-contain"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Globe className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{siteName || domain}</span>
      </div>
      {title ? (
        <p className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">{title}</p>
      ) : null}
      {description ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {image && !imageFailed ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="mt-1.5 max-h-36 w-full rounded-md border border-border object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </div>
  );
}
