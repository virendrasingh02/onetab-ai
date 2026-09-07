/**
 * One place that turns any "go here" string the platform produces — a custom
 * protocol deep link (`onetab://…` / `mie://…`), a workspace-relative target
 * from a notification's `deepLink` field (`c/general`, `tasks?taskId=1`), or an
 * already-absolute SPA path (`/w/acme/inbox`) — into the single in-app route the
 * router should navigate to.
 *
 * Framework-agnostic on purpose (same rule as the rest of `@org/platform`): the
 * Electron main process, the renderer's `DesktopProvider`, and the in-app
 * notification handler all feed their string through here so a link resolves to
 * the *same* place no matter which entry point received it.
 */

export interface DeepLinkContext {
  /**
   * The workspace the user is currently in. Workspace-relative targets and
   * scheme links that omit a workspace are resolved against this.
   */
  workspaceSlug?: string | null;
  /** Custom protocol schemes the shell registers, without the `://`. */
  schemes?: readonly string[];
}

export interface ResolvedDeepLink {
  /** In-app route (leading slash), or `null` when it cannot be resolved here. */
  route: string | null;
  /**
   * The target named a workspace that {@link DeepLinkContext.workspaceSlug}
   * could not confirm. The route is still returned as a best effort; the caller
   * may prefer its web fallback.
   */
  crossWorkspace: boolean;
  /**
   * `onetab://auth/callback?…` — consumed by the desktop shell's PKCE handler,
   * never navigated to. The caller should ignore {@link route} when this is set.
   */
  isAuthCallback: boolean;
}

const DEFAULT_SCHEMES = ['onetab', 'mie'] as const;

/** Paths that are already real top-level SPA routes and pass straight through. */
const ABSOLUTE_PASSTHROUGH = [
  '/w/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/invite/',
  '/workspaces/new',
  '/open',
  '/404',
];

function splitQueryHash(target: string): {
  path: string;
  query: string;
  hash: string;
} {
  const hashAt = target.indexOf('#');
  const hash = hashAt >= 0 ? target.slice(hashAt) : '';
  const withoutHash = hashAt >= 0 ? target.slice(0, hashAt) : target;
  const queryAt = withoutHash.indexOf('?');
  const query = queryAt >= 0 ? withoutHash.slice(queryAt) : '';
  const path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  return { path, query, hash };
}

function mergeQuery(base: string, extra: string): string {
  const params = new URLSearchParams(base.startsWith('?') ? base.slice(1) : base);
  const more = new URLSearchParams(
    extra.startsWith('?') ? extra.slice(1) : extra,
  );
  for (const [key, value] of more) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/**
 * Maps the id-style segments the brief and the marketing links use
 * (`channel/456`, `project/1/issue/9`) onto the segments the router actually
 * defines (`c/456`, `tasks/1?taskId=9`). Anything already in router shape —
 * `inbox`, `c/general`, `tasks?taskId=1` — passes through untouched.
 */
function mapScopedTarget(rawTarget: string): string {
  const { path, query, hash } = splitQueryHash(rawTarget.replace(/^\/+/, ''));
  const segments = path.split('/').filter(Boolean);

  const build = (parts: string[], addedQuery = '') =>
    parts.join('/') + mergeQuery(query, addedQuery) + hash;

  if (segments.length === 0) return build([]);

  switch (segments[0]) {
    case 'channel':
      return segments[1] ? build(['c', segments[1]]) : build(['channels']);
    case 'dm':
      return segments[1] ? build(['dms', segments[1]]) : build(['dms']);
    case 'project':
    case 'projects':
      if (segments[2] === 'issue' && segments[3]) {
        return build(['tasks', segments[1]], `taskId=${segments[3]}`);
      }
      return segments[1]
        ? build(['projects', segments[1]])
        : build(['projects']);
    case 'issue':
    case 'task':
      return segments[1]
        ? build(['tasks'], `taskId=${segments[1]}`)
        : build(['tasks']);
    case 'doc':
    case 'document':
      return segments[1] ? build(['docs', segments[1]]) : build(['docs']);
    case 'agent':
      return segments[1]
        ? build(['agents', segments[1], 'chat'])
        : build(['agents']);
    case 'file':
      return segments[1]
        ? build(['files'], `fileId=${segments[1]}`)
        : build(['files']);
    default:
      return build(segments);
  }
}

function stripScheme(
  input: string,
  schemes: readonly string[],
): string | null {
  for (const scheme of schemes) {
    const prefix = `${scheme}://`;
    if (input.toLowerCase().startsWith(prefix)) {
      return input.slice(prefix.length);
    }
  }
  return null;
}

export function resolveDeepLinkRoute(
  input: string | null | undefined,
  context: DeepLinkContext = {},
): ResolvedDeepLink {
  const miss: ResolvedDeepLink = {
    route: null,
    crossWorkspace: false,
    isAuthCallback: false,
  };
  if (!input) return miss;

  const schemes = context.schemes ?? DEFAULT_SCHEMES;
  const slug = context.workspaceSlug?.trim() || null;

  let bare = stripScheme(input.trim(), schemes);
  const cameFromScheme = bare !== null;
  if (bare === null) bare = input.trim();

  // Custom-scheme host + path collapse to one relative target.
  bare = bare.replace(/^\/+/, '');
  if (bare === '') return miss;

  // Auth callback — the shell handles it; never a navigation.
  if (/^auth\/callback(?:[/?#]|$)/i.test(bare)) {
    return { route: null, crossWorkspace: false, isAuthCallback: true };
  }

  // Already an absolute SPA path (only trusted when it did not arrive as a
  // custom-scheme link — a scheme link's "path" is really a relative target).
  if (!cameFromScheme && input.trim().startsWith('/')) {
    const path = input.trim();
    if (path === '/' || ABSOLUTE_PASSTHROUGH.some((p) => path.startsWith(p))) {
      return { route: path, crossWorkspace: false, isAuthCallback: false };
    }
    // `/c/general` style — treat as workspace-relative.
    bare = path.slice(1);
  }

  // `w/{slug}/…` is a fully-qualified app route missing only its leading slash.
  if (/^w\//i.test(bare)) {
    return { route: `/${bare}`, crossWorkspace: false, isAuthCallback: false };
  }

  // `workspace/{slugOrId}/{…rest}` — the marketing / brief link shape.
  const wsMatch = /^workspace\/([^/]+)(?:\/(.*))?$/i.exec(bare);
  if (wsMatch) {
    const named = decodeURIComponent(wsMatch[1]);
    const rest = wsMatch[2] ?? '';
    const crossWorkspace = slug != null && named !== slug;
    const targetSlug = slug ?? named;
    const mapped = mapScopedTarget(rest);
    return {
      route: mapped ? `/w/${targetSlug}/${mapped}` : `/w/${targetSlug}`,
      crossWorkspace,
      isAuthCallback: false,
    };
  }

  // Bare workspace-relative target (`c/general`, `tasks?taskId=1`, `inbox`).
  if (!slug) return miss;
  const mapped = mapScopedTarget(bare);
  return {
    route: mapped ? `/w/${slug}/${mapped}` : `/w/${slug}`,
    crossWorkspace: false,
    isAuthCallback: false,
  };
}
