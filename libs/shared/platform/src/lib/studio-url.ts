/**
 * Where the standalone AI Agent Studio app lives, and how to build links into
 * it. The main app never embeds the Studio; it hands off to this URL.
 */
const DEFAULT_STUDIO_APP_URL = 'http://localhost:4202';

function readStudioBase(): string {
  try {
    // `import.meta.env` is Vite-only and absent from this lib's ambient types;
    // read it through a structural view so Node consumers still type-check.
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const value = env?.['VITE_STUDIO_APP_URL'];
    if (typeof value === 'string' && value) return value;
  } catch {
    // ignore
  }
  return DEFAULT_STUDIO_APP_URL;
}

/** An absolute Studio URL for `path` (e.g. `/w/acme/ai/agents`). */
export function studioAppUrl(path = ''): string {
  return `${readStudioBase().replace(/\/+$/, '')}${path}`;
}

/** A path inside the Studio's workspace area: `/w/<slug>/ai[/segments]`. */
export function studioWorkspacePath(slug: string, ...segments: string[]): string {
  const rest = segments.filter(Boolean).join('/');
  return `/w/${slug}/ai${rest ? `/${rest}` : ''}`;
}
