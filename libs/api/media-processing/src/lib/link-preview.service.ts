import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CacheService } from '@org/api-cache';
import type {
  LinkPreview,
  LinkPreviewStatus,
  LinkPreviewVisibility,
} from '@org/types';
import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';

const REQUEST_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VISIBILITY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  '_ga',
]);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
]);

export interface RawExtractedMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain: string;
  siteName?: string;
  mediaType?: 'website' | 'article' | 'video' | 'audio' | 'image' | 'rich';
  oembedUrl?: string;
}

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly inFlightRequests = new Map<string, Promise<LinkPreview>>();

  constructor(private readonly cache: CacheService) {}

  /**
   * Normalizes a URL by lowercasing scheme and host, removing tracking params,
   * removing fragments, and normalizing default ports.
   */
  normalizeUrl(rawUrl: string): string {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';

    // Remove tracking parameters
    const toDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (
        TRACKING_PARAMS.has(key.toLowerCase()) ||
        key.toLowerCase().startsWith('utm_')
      ) {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) {
      parsed.searchParams.delete(key);
    }

    // Normalize default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Normalize trailing slash on root
    let href = parsed.toString();
    if (href.endsWith('/') && parsed.pathname === '/' && !parsed.search) {
      href = href.slice(0, -1);
    }

    return href;
  }

  /**
   * Checks whether an IP address is a private, loopback, link-local, or reserved address.
   */
  isPrivateOrBlockedIp(ip: string): boolean {
    if (!ip) return true;

    // IPv4-mapped IPv6 address (e.g. ::ffff:192.168.1.1)
    if (ip.toLowerCase().startsWith('::ffff:')) {
      const v4Part = ip.slice(7);
      if (net.isIPv4(v4Part)) {
        return this.isPrivateOrBlockedIp(v4Part);
      }
    }

    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return true;
      }
      const [a, b] = parts;

      // 0.0.0.0/8 (Current network)
      if (a === 0) return true;
      // 10.0.0.0/8 (Private)
      if (a === 10) return true;
      // 100.64.0.0/10 (Carrier-grade NAT 100.64.0.0 - 100.127.255.255)
      if (a === 100 && b >= 64 && b <= 127) return true;
      // 127.0.0.0/8 (Loopback)
      if (a === 127) return true;
      // 169.254.0.0/16 (Link-local / AWS / GCP metadata)
      if (a === 169 && b === 254) return true;
      // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.0.0.0/24 (IETF Protocol Assignments)
      if (a === 192 && b === 0 && parts[2] === 0) return true;
      // 192.0.2.0/24 (TEST-NET-1)
      if (a === 192 && b === 0 && parts[2] === 2) return true;
      // 192.168.0.0/16 (Private)
      if (a === 192 && b === 168) return true;
      // 198.18.0.0/15 (Network benchmark tests)
      if (a === 198 && (b === 18 || b === 19)) return true;
      // 198.51.100.0/24 (TEST-NET-2)
      if (a === 198 && b === 51 && parts[2] === 100) return true;
      // 203.0.113.0/24 (TEST-NET-3)
      if (a === 203 && b === 0 && parts[2] === 113) return true;
      // 224.0.0.0/4 (Multicast 224.0.0.0 - 239.255.255.255)
      if (a >= 224 && a <= 239) return true;
      // 240.0.0.0/4 (Reserved 240.0.0.0 - 255.255.255.254)
      if (a >= 240) return true;
      // 255.255.255.255 (Broadcast)
      if (ip === '255.255.255.255') return true;

      return false;
    }

    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      // ::1 (Loopback)
      if (lower === '::1') return true;
      // :: (Unspecified)
      if (lower === '::') return true;
      // fc00::/7 (Unique Local Address fc00... / fd00...)
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
      // fe80::/10 (Link-Local Address fe8... / fe9... / fea... / feb...)
      if (
        lower.startsWith('fe8') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb')
      ) {
        return true;
      }

      return false;
    }

    return true;
  }

  /**
   * Performs SSRF and protocol validation for a URL.
   * Resolves DNS and asserts that all resolved IP addresses are public.
   */
  async validateUrlSecurity(parsedUrl: URL): Promise<void> {
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new BadRequestException(
        `Unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are allowed.`,
      );
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new BadRequestException(
        'URLs with embedded credentials are not allowed.',
      );
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname) {
      throw new BadRequestException('URL must have a valid hostname.');
    }

    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.corp') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.example') ||
      hostname.endsWith('.invalid')
    ) {
      throw new BadRequestException(
        `Access to internal or private hostname "${hostname}" is blocked.`,
      );
    }

    // If hostname is directly an IP literal, validate it
    if (net.isIP(hostname)) {
      if (this.isPrivateOrBlockedIp(hostname)) {
        throw new BadRequestException(
          `Access to private/reserved IP address "${hostname}" is blocked.`,
        );
      }
      return;
    }

    // Resolve DNS and check all returned IPs
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        throw new BadRequestException(
          `Could not resolve hostname "${hostname}".`,
        );
      }

      for (const record of records) {
        if (this.isPrivateOrBlockedIp(record.address)) {
          throw new BadRequestException(
            `Hostname "${hostname}" resolved to blocked private IP address "${record.address}".`,
          );
        }
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `DNS resolution failed for hostname "${hostname}": ${err.message}`,
      );
    }
  }

  /**
   * Creates an HTTP/HTTPS agent that protects against DNS rebinding attacks
   * by verifying the resolved IP on every socket connection.
   */
  private createSafeAgent(protocol: string) {
    const isHttps = protocol === 'https:';
    const AgentClass = isHttps ? https.Agent : http.Agent;

    return new AgentClass({
      keepAlive: false,
      timeout: REQUEST_TIMEOUT_MS,
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, options, (err, address, family) => {
          if (err) return callback(err, address, family);
          if (typeof address === 'string' && this.isPrivateOrBlockedIp(address)) {
            return callback(
              new Error(
                `DNS rebinding blocked: resolved to private IP "${address}"`,
              ),
              address,
              family,
            );
          }
          callback(null, address, family);
        });
      },
    });
  }

  /**
   * Safely fetches a URL with SSRF protection, size limits, redirect limits, and timeouts.
   */
  async safeFetchHtml(
    targetUrl: string,
    redirectsLeft = MAX_REDIRECTS,
  ): Promise<{ html: string; finalUrl: string }> {
    const parsed = new URL(targetUrl);
    await this.validateUrlSecurity(parsed);

    return new Promise((resolve, reject) => {
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;
      const agent = this.createSafeAgent(parsed.protocol);

      const req = transport.request(
        parsed,
        {
          method: 'GET',
          agent,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; OneTabBot/1.0; +https://onetab.ai/bot)',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.1',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (res) => {
          // Handle HTTP redirects (301, 302, 303, 307, 308)
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            req.destroy();
            if (redirectsLeft <= 0) {
              return reject(new BadRequestException('Maximum redirects exceeded.'));
            }

            try {
              const redirectUrl = new URL(res.headers.location, targetUrl).href;
              return resolve(this.safeFetchHtml(redirectUrl, redirectsLeft - 1));
            } catch (err: any) {
              return reject(
                new BadRequestException(
                  `Invalid redirect URL "${res.headers.location}": ${err.message}`,
                ),
              );
            }
          }

          // Validate status code
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            req.destroy();
            return reject(
              new BadRequestException(
                `Remote server responded with HTTP status ${res.statusCode}.`,
              ),
            );
          }

          // Validate Content-Type
          const contentType = res.headers['content-type']?.toLowerCase() ?? '';
          if (
            !contentType.includes('text/html') &&
            !contentType.includes('application/xhtml+xml') &&
            !contentType.includes('application/json')
          ) {
            req.destroy();
            return reject(
              new BadRequestException(
                `Unsupported response Content-Type "${contentType}". Previews only support HTML documents.`,
              ),
            );
          }

          let body = '';
          let bytesReceived = 0;

          res.setEncoding('utf8');

          res.on('data', (chunk: string) => {
            bytesReceived += Buffer.byteLength(chunk, 'utf8');
            body += chunk;

            // Stop reading if body limit exceeded
            if (bytesReceived >= MAX_BODY_BYTES) {
              req.destroy();
              resolve({ html: body, finalUrl: targetUrl });
            }
          });

          res.on('end', () => {
            resolve({ html: body, finalUrl: targetUrl });
          });

          res.on('error', (err) => {
            reject(
              new BadRequestException(`Failed to read response: ${err.message}`),
            );
          });
        },
      );

      req.on('timeout', () => {
        req.destroy();
        reject(
          new BadRequestException(
            `Request timed out after ${REQUEST_TIMEOUT_MS}ms.`,
          ),
        );
      });

      req.on('error', (err) => {
        reject(
          new BadRequestException(`Request failed: ${err.message}`),
        );
      });

      req.end();
    });
  }

  /**
   * Sanitizes string by stripping HTML tags, unescaping entities, and trimming.
   */
  sanitizeText(raw?: string, maxLength = 300): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;

    const stripped = raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!stripped) return undefined;
    return stripped.length > maxLength
      ? `${stripped.slice(0, maxLength - 1).trim()}…`
      : stripped;
  }

  /**
   * Safely resolves a media or favicon URL relative to the base page URL.
   */
  resolveAbsoluteUrl(relativeOrAbsolute: string | undefined, baseUrl: string): string | undefined {
    if (!relativeOrAbsolute || typeof relativeOrAbsolute !== 'string') {
      return undefined;
    }

    try {
      const resolved = new URL(relativeOrAbsolute.trim(), baseUrl).href;
      const parsed = new URL(resolved);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return undefined;
      }
      return resolved;
    } catch {
      return undefined;
    }
  }

  /**
   * Extracts metadata from HTML string (Open Graph, Twitter cards, standard HTML tags, oEmbed).
   */
  extractMetadata(html: string, pageUrl: string): RawExtractedMetadata {
    const parsedPageUrl = new URL(pageUrl);
    const domain = parsedPageUrl.hostname.replace(/^www\./i, '');

    const metaTags = new Map<string, string>();

    // Extract <title>...</title>
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const htmlTitle = titleMatch ? titleMatch[1] : undefined;

    const getAttr = (attrs: string, attrName: string): string | undefined => {
      const regex = new RegExp(
        `(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
        'i',
      );
      const m = regex.exec(attrs);
      if (!m) return undefined;
      return m[1] ?? m[2] ?? m[3];
    };

    // Match all <meta ...> tags, properly handling > inside quoted attribute values
    const metaRegex = /<meta\s+((?:[^>"']|"[^"]*"|'[^']*')+)/gi;
    let match: RegExpExecArray | null;
    while ((match = metaRegex.exec(html)) !== null) {
      const tagAttrs = match[1];
      const name = getAttr(tagAttrs, 'name') || getAttr(tagAttrs, 'property');
      const content = getAttr(tagAttrs, 'content');

      if (name && content !== undefined) {
        const key = name.toLowerCase().trim();
        const value = content.trim();
        if (key && value && !metaTags.has(key)) {
          metaTags.set(key, value);
        }
      }
    }

    // Match <link rel="..." href="...">, properly handling > inside quoted attribute values
    let faviconUrl: string | undefined;
    let oembedUrl: string | undefined;
    const linkRegex = /<link\s+((?:[^>"']|"[^"]*"|'[^']*')+)/gi;
    while ((match = linkRegex.exec(html)) !== null) {
      const tagAttrs = match[1];
      const rel = getAttr(tagAttrs, 'rel')?.toLowerCase();
      const href = getAttr(tagAttrs, 'href');
      const type = getAttr(tagAttrs, 'type')?.toLowerCase();

      if (rel && href) {
        if (
          !faviconUrl &&
          (rel.includes('icon') || rel === 'apple-touch-icon')
        ) {
          faviconUrl = this.resolveAbsoluteUrl(href, pageUrl);
        }
        if (
          !oembedUrl &&
          rel === 'alternate' &&
          type === 'application/json+oembed'
        ) {
          oembedUrl = this.resolveAbsoluteUrl(href, pageUrl);
        }
      }
    }

    // Fallback default favicon
    if (!faviconUrl) {
      faviconUrl = `${parsedPageUrl.origin}/favicon.ico`;
    }

    // Extract Open Graph / Twitter card values
    const ogTitle = metaTags.get('og:title');
    const twitterTitle = metaTags.get('twitter:title');

    const ogDescription = metaTags.get('og:description');
    const twitterDescription = metaTags.get('twitter:description');
    const metaDescription = metaTags.get('description');

    const ogImage =
      metaTags.get('og:image') ||
      metaTags.get('og:image:url') ||
      metaTags.get('og:image:secure_url');
    const twitterImage =
      metaTags.get('twitter:image') || metaTags.get('twitter:image:src');

    const ogSiteName = metaTags.get('og:site_name');
    const ogType = metaTags.get('og:type')?.toLowerCase();

    let mediaType: RawExtractedMetadata['mediaType'] = 'website';
    if (ogType === 'article') mediaType = 'article';
    else if (ogType?.includes('video')) mediaType = 'video';
    else if (ogType?.includes('music') || ogType?.includes('audio'))
      mediaType = 'audio';
    else if (ogType?.includes('photo') || ogType?.includes('image'))
      mediaType = 'image';

    const rawTitle = ogTitle || twitterTitle || htmlTitle;
    const rawDescription = ogDescription || twitterDescription || metaDescription;
    const rawImage = ogImage || twitterImage;

    return {
      title: this.sanitizeText(rawTitle, 250),
      description: this.sanitizeText(rawDescription, 500),
      image: this.resolveAbsoluteUrl(rawImage, pageUrl),
      favicon: faviconUrl,
      domain,
      siteName: this.sanitizeText(ogSiteName, 100),
      mediaType,
      oembedUrl,
    };
  }

  /**
   * Fetches oEmbed metadata if discovered and safely merges it.
   */
  private async enrichWithOembed(
    metadata: RawExtractedMetadata,
  ): Promise<RawExtractedMetadata> {
    if (!metadata.oembedUrl) return metadata;

    try {
      const { html: jsonBody, finalUrl } = await this.safeFetchHtml(
        metadata.oembedUrl,
      );
      const oembed = JSON.parse(jsonBody);

      if (oembed && typeof oembed === 'object') {
        const title = this.sanitizeText(oembed.title, 250);
        const provider = this.sanitizeText(oembed.provider_name, 100);
        const thumb = this.resolveAbsoluteUrl(
          oembed.thumbnail_url || oembed.url,
          finalUrl,
        );

        return {
          ...metadata,
          title: metadata.title || title,
          siteName: metadata.siteName || provider,
          image: metadata.image || thumb,
        };
      }
    } catch {
      // oEmbed is best-effort enrichment, ignore failure and proceed with HTML metadata
    }

    return metadata;
  }

  /**
   * Fetches preview metadata for a URL with caching, SSRF security, and deduplication.
   */
  async getPreview(rawUrl: string): Promise<LinkPreview> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new BadRequestException('URL parameter is required.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException(`Invalid URL format: "${rawUrl}"`);
    }

    const normalizedUrl = this.normalizeUrl(rawUrl);
    const cacheKey = `link-preview:${normalizedUrl}`;

    // 1. Check cache first
    try {
      const cached = await this.cache.get<LinkPreview>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      this.logger.warn(`Cache lookup failed for "${cacheKey}": ${err}`);
    }

    // 2. Request deduplication (in-flight map)
    const inFlight = this.inFlightRequests.get(normalizedUrl);
    if (inFlight) {
      return inFlight;
    }

    // 3. Perform fetch
    const fetchPromise = (async () => {
      const now = Date.now();
      const domain = parsedUrl.hostname.replace(/^www\./i, '');

      try {
        const { html, finalUrl } = await this.safeFetchHtml(rawUrl);
        let metadata = this.extractMetadata(html, finalUrl);

        if (metadata.oembedUrl) {
          metadata = await this.enrichWithOembed(metadata);
        }

        const hasInfo = Boolean(metadata.title || metadata.description || metadata.image);
        const status: LinkPreviewStatus = hasInfo ? 'ready' : 'unavailable';

        const preview: LinkPreview = {
          id: `preview_${Math.random().toString(36).slice(2, 11)}`,
          url: rawUrl,
          normalizedUrl,
          title: metadata.title,
          description: metadata.description,
          image: metadata.image,
          favicon: metadata.favicon,
          domain: metadata.domain || domain,
          siteName: metadata.siteName,
          mediaType: metadata.mediaType,
          status,
          visibility: 'visible',
          createdAt: now,
          updatedAt: now,
        };

        // Cache result
        await this.cache.set(cacheKey, preview, CACHE_TTL_MS).catch(() => undefined);
        return preview;
      } catch (err: any) {
        this.logger.debug(`Preview generation failed for "${rawUrl}": ${err.message}`);

        const isBlocked = err instanceof BadRequestException && err.message.includes('blocked');
        const status: LinkPreviewStatus = isBlocked ? 'blocked' : 'error';

        const errorPreview: LinkPreview = {
          id: `preview_${Math.random().toString(36).slice(2, 11)}`,
          url: rawUrl,
          normalizedUrl,
          domain,
          status,
          visibility: 'hidden',
          createdAt: now,
          updatedAt: now,
        };

        // Cache negative responses for 10 minutes to avoid hammering failed endpoints
        await this.cache.set(cacheKey, errorPreview, 10 * 60 * 1000).catch(() => undefined);
        return errorPreview;
      } finally {
        this.inFlightRequests.delete(normalizedUrl);
      }
    })();

    this.inFlightRequests.set(normalizedUrl, fetchPromise);
    return fetchPromise;
  }

  /**
   * Sets the link preview visibility override for a specific message.
   */
  async setMessageVisibility(
    messageId: string,
    visibility: LinkPreviewVisibility,
  ): Promise<void> {
    const key = `link-preview:visibility:${messageId}`;
    await this.cache.set(key, visibility, VISIBILITY_CACHE_TTL_MS);
  }

  /**
   * Retrieves the link preview visibility override for a specific message, if any.
   */
  async getMessageVisibility(
    messageId: string,
  ): Promise<LinkPreviewVisibility | null> {
    const key = `link-preview:visibility:${messageId}`;
    return this.cache.get<LinkPreviewVisibility>(key);
  }
}
