import { Injectable, Logger } from '@nestjs/common';
import { AISecretsService } from '@org/api-ai';
import { safeFetch, UnsafeUrlError } from '@org/api-common';

export interface FirecrawlSearchOptions {
  limit?: number;
  scrapeOptions?: {
    formats?: ('markdown' | 'html')[];
    onlyMainContent?: boolean;
  };
}

export interface FirecrawlSearchResult {
  success: boolean;
  data: Array<{
    title: string;
    url: string;
    description?: string;
    markdown?: string;
  }>;
}

/** The slice of Firecrawl's page metadata this service reads. */
interface FirecrawlPageMetadata {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/** Raw Firecrawl response bodies — `fetch().json()` is `unknown` under Node's types. */
interface FirecrawlSearchResponse {
  data?: Array<{
    title?: string;
    url: string;
    description?: string;
    markdown?: string;
    content?: string;
    metadata?: FirecrawlPageMetadata;
  }>;
}

interface FirecrawlScrapeResponse {
  data?: {
    markdown?: string;
    content?: string;
    metadata?: FirecrawlPageMetadata;
  };
}

interface FirecrawlCrawlResponse {
  id?: string;
  data?: Array<{ url: string; markdown: string; title?: string }>;
}

export interface FirecrawlScrapeResult {
  success: boolean;
  data: {
    markdown: string;
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface FirecrawlCrawlResult {
  success: boolean;
  id?: string;
  data: Array<{
    url: string;
    markdown: string;
    title?: string;
  }>;
}

export interface FirecrawlExtractResult {
  success: boolean;
  data: Record<string, unknown>;
}

@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);

  constructor(private readonly secrets: AISecretsService) {}

  /**
   * The workspace's `FIRECRAWL_API_KEY` secret, decrypted, else the
   * deployment's env key. This used to hand Firecrawl the *ciphertext*
   * straight from the row, so a workspace-configured key could never
   * authenticate and every call quietly fell through to the fallbacks.
   */
  private async getApiKey(workspaceId: string): Promise<string | null> {
    if (workspaceId) {
      try {
        const key = await this.secrets.getDecryptedSecret(workspaceId, 'FIRECRAWL_API_KEY');
        if (key) return key;
      } catch (err) {
        this.logger.warn(`Could not read FIRECRAWL_API_KEY for ${workspaceId}: ${String(err)}`);
      }
    }
    return process.env['FIRECRAWL_API_KEY'] || null;
  }

  /**
   * Clean HTML string into basic readable Markdown
   */
  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Search the web using Firecrawl API or fallback web search
   */
  async search(
    query: string,
    options: FirecrawlSearchOptions = {},
    workspaceId = '',
  ): Promise<FirecrawlSearchResult> {
    const limit = options.limit ?? 5;
    const apiKey = await this.getApiKey(workspaceId);

    if (apiKey) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit,
            scrapeOptions: { formats: ['markdown'] },
          }),
        });

        if (response.ok) {
          const json = (await response.json()) as FirecrawlSearchResponse;
          return {
            success: true,
            data: (json.data || []).map((item) => ({
              title: item.title || item.metadata?.title || 'Search Result',
              url: item.url,
              description: item.description || item.metadata?.description || '',
              markdown: item.markdown || item.content || '',
            })),
          };
        }
      } catch (err) {
        this.logger.warn(`Firecrawl API search failed, using fallback: ${err}`);
      }
    }

    // High quality fallback web search via DuckDuckGo HTML / instant API
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const html = await res.text();
      const results: Array<{ title: string; url: string; description: string; markdown: string }> = [];

      // Extract duckduckgo search result links
      const linkRegex = /<a[^>]+class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
      const titleRegex = /<a[^>]+class="result__snippet"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

      let match;
      let count = 0;
      while ((match = linkRegex.exec(html)) !== null && count < limit) {
        const rawUrl = match[1];
        let url = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch && uddgMatch[1]) {
          url = decodeURIComponent(uddgMatch[1]);
        }
        const snippet = titleRegex.exec(html)?.[2]?.replace(/<[^>]+>/g, '') ?? '';
        results.push({
          title: `Result ${count + 1} for: ${query}`,
          url,
          description: snippet,
          markdown: `### [Result ${count + 1}](${url})\n\n${snippet}\n`,
        });
        count++;
      }

      if (results.length > 0) {
        return { success: true, data: results };
      }
    } catch {
      // Ignore
    }

    // Nothing found. Say so rather than inventing a result: this used to
    // return a fabricated "Web Overview" pointing at example.com with
    // `success: true`, which agents then cited as a real source.
    return { success: false, data: [] };
  }

  /**
   * Scrapes a webpage and converts to clean markdown
   */
  async scrape(url: string, workspaceId = ''): Promise<FirecrawlScrapeResult> {
    const apiKey = await this.getApiKey(workspaceId);

    if (apiKey) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        if (response.ok) {
          const json = (await response.json()) as FirecrawlScrapeResponse;
          return {
            success: true,
            data: {
              markdown: json.data?.markdown || json.data?.content || '',
              title: json.data?.metadata?.title || url,
              description: json.data?.metadata?.description,
              metadata: json.data?.metadata,
            },
          };
        }
      } catch (err) {
        this.logger.warn(`Firecrawl scrape failed, using fallback: ${err}`);
      }
    }

    // Fallback: fetch the page ourselves. The URL comes from a member, a
    // workflow payload or a model's tool call, so it must go through the
    // SSRF guard — a raw fetch here let anyone read cloud metadata or
    // internal services through the scrape tool.
    try {
      const res = await safeFetch(url, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
        maxBytes: 2 * 1024 * 1024,
      });
      if (!res.ok) {
        return {
          success: false,
          data: { title: 'Error scraping page', markdown: `The page answered HTTP ${res.status}.` },
        };
      }
      const html = res.text();
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : url;
      const markdown = this.htmlToMarkdown(html);

      return {
        success: true,
        data: {
          title,
          markdown: `# ${title}\n\nSource: [${url}](${url})\n\n${markdown.slice(0, 15_000)}`,
          metadata: { url, fetchedAt: new Date().toISOString() },
        },
      };
    } catch (err) {
      const reason =
        err instanceof UnsafeUrlError
          ? `refused — ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        success: false,
        data: {
          title: 'Error scraping page',
          markdown: `Could not retrieve content from ${url}: ${reason}`,
        },
      };
    }
  }

  /**
   * Crawls a website up to a page limit
   */
  async crawl(
    url: string,
    limit = 5,
    workspaceId = '',
  ): Promise<FirecrawlCrawlResult> {
    const apiKey = await this.getApiKey(workspaceId);

    if (apiKey) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/crawl', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, limit, scrapeOptions: { formats: ['markdown'] } }),
        });

        if (response.ok) {
          const json = (await response.json()) as FirecrawlCrawlResponse;
          return {
            success: true,
            id: json.id,
            data: json.data || [],
          };
        }
      } catch (err) {
        this.logger.warn(`Firecrawl crawl failed, using fallback: ${err}`);
      }
    }

    // Fallback: Scrape the root page
    const scraped = await this.scrape(url, workspaceId);
    return {
      success: scraped.success,
      data: [
        {
          url,
          title: scraped.data.title || url,
          markdown: scraped.data.markdown,
        },
      ],
    };
  }

  /**
   * Fetches a page for extraction. Firecrawl's hosted extraction is not wired
   * up, so this returns the page content and the extraction brief for the
   * caller's model to work from — it no longer claims an extraction
   * ("Extracted content matching …") it never performed.
   */
  async extract(
    url: string,
    prompt: string,
    schema?: Record<string, unknown>,
    workspaceId = '',
  ): Promise<FirecrawlExtractResult> {
    const scraped = await this.scrape(url, workspaceId);
    return {
      success: scraped.success,
      data: {
        url,
        title: scraped.data.title,
        instructions: prompt,
        ...(schema ? { schema } : {}),
        content: scraped.data.markdown.slice(0, 15_000),
      },
    };
  }
}
