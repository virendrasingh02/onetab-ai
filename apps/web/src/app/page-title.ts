import { matchPath } from 'react-router-dom';

/**
 * Single source of truth for the contextual page/tab title.
 *
 * The route table this mirrors lives next door in `app.tsx`; keeping the
 * resolver beside it means a new route and its title land in the same review.
 * Nothing here touches React or the network — `<DocumentTitle>` feeds it the
 * canonical entity names it has already read from the TanStack Query cache.
 */

/**
 * Product name. Mirrors `<title>` in `apps/web/index.html` and the
 * `BrowserWindow` title in `apps/desktop/src/main/window.ts`.
 */
export const APP_NAME = 'OneTab AI';

/**
 * Canonical, server-owned names for the resources a dynamic route points at.
 * Every field is optional: a value that is still loading (or gone) is simply
 * absent, and the resolver falls back to a safe generic label.
 */
export interface PageTitleEntities {
  /** Name of the workspace in the current `/w/:slug` path, if resolved. */
  workspaceName?: string;
  /** The channel for `/c/:channelSlug`. */
  channel?: { name: string; isPrivate?: boolean };
  /** Display name of the peer for `/dms/:peerId` (person, agent or app). */
  dmPeerName?: string;
  /** Name of the project for `/projects/:projectId` or `/tasks/:projectId`. */
  projectName?: string;
  /** Name of the agent for `/agents/:agentId/chat`. */
  agentName?: string;
  /** Name of the connected app for `/apps/:appId/chat`. */
  appName?: string;
  /** Title of the document for `/docs/:docId` or `/notes/:docId`. */
  docTitle?: string;
}

export interface ResolvedPageTitle {
  /**
   * The bare contextual title, e.g. `# engineering` or `Files`. Empty only for
   * routes with no title of their own (auth callbacks), where the document
   * title falls back to {@link APP_NAME}.
   */
  title: string;
  /**
   * A dynamic resource for this route has not resolved yet, so `title` holds a
   * generic placeholder that will be replaced once the name reaches the cache.
   * Callers that render a title inline can use this to show a loading state;
   * the document title just displays the placeholder.
   */
  isPending: boolean;
}

/**
 * `# name` for public channels; the bare name for private ones, where the `#`
 * would misrepresent visibility. Any leading `#` already on the stored name is
 * stripped first so it is never doubled.
 */
export function formatChannelName(
  name: string,
  opts: { isPrivate?: boolean } = {},
): string {
  const clean = name.replace(/^#+\s*/, '').trim();
  return opts.isPrivate ? clean : `#${clean}`;
}

/** `<context> — OneTab AI`, or just `OneTab AI` when there is no context. */
export function formatDocumentTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed && trimmed !== APP_NAME
    ? `${trimmed} — ${APP_NAME}`
    : APP_NAME;
}

/** Routes that live outside any workspace. Keyed by exact pathname. */
const ROOT_STATIC_TITLES: Record<string, string> = {
  '/': 'Home',
  '/open': 'Home',
  '/login': 'Sign in',
  '/register': 'Create your account',
  '/forgot-password': 'Reset your password',
  '/reset-password': 'Reset your password',
  '/workspaces/new': 'Create a workspace',
  '/settings': 'Settings',
  '/404': 'Page not found',
};

/**
 * Fixed titles for workspace sub-paths — everything after `/w/:workspaceSlug`,
 * with its leading slash (the workspace root is the empty string).
 *
 * Labels track the sidebar (`DEFAULT_NAV_ITEMS` in
 * `libs/web/layout/src/lib/navigation/navigation.config.ts`); routes with no
 * sidebar entry get a concise equivalent. Alias routes that render the same
 * screen (`/tasks`, `/kanban`, `/work`, …) share one title.
 */
const WORKSPACE_STATIC_TITLES: Record<string, string> = {
  '': 'Home',
  '/home': 'Home',
  '/dashboard': 'Dashboard',
  '/overview': 'Dashboard',
  '/inbox': 'Inbox',
  '/threads': 'Threads',
  '/saved': 'Saved Items',
  '/members': 'Team Directory',
  '/directory': 'Team Directory',
  '/invitations': 'Invitations',
  '/channels': 'Channels',
  '/channels/new': 'Create a channel',
  '/tasks': 'Tasks & Projects',
  '/kanban': 'Tasks & Projects',
  '/work': 'Tasks & Projects',
  '/projects': 'Tasks & Projects',
  '/cycles': 'Tasks & Projects',
  '/intake': 'Tasks & Projects',
  '/initiatives': 'Tasks & Projects',
  '/notes': 'Docs & Notes',
  '/docs': 'Docs & Notes',
  '/files': 'Files',
  '/whiteboards': 'Whiteboards',
  '/meetings': 'Meetings',
  '/schedule': 'Schedule & Calendar',
  '/pulse': 'Activity Pulse',
  '/timeline': 'Activity Pulse',
  '/activity': 'Activity Pulse',
  '/dms': 'Direct Messages',
  '/ai-chat': 'AI Assistant',
  '/ai/prompts': 'Prompt Library',
  '/agents': 'AI Agents',
  '/agents/chat': 'AI Agents',
  '/agents/builder': 'Agent Builder',
  '/agents/logs': 'Agent Monitoring',
  '/automations': 'Automations & Workflows',
  '/automations/builder': 'Automations & Workflows',
  '/automations/logs': 'Automations & Workflows',
  '/integrations': 'Integration Hub',
  '/apps': 'Apps',
  '/apps/chat': 'Apps',
};

const WS_PREFIX = { path: '/w/:workspaceSlug', end: false } as const;

/** Matches `pattern` against `pathname`, ignoring a trailing slash. */
function match(pattern: string, pathname: string) {
  return matchPath({ path: pattern, end: false }, pathname);
}

/**
 * Resolve the contextual title for a location.
 *
 * @param pathname  `location.pathname` from the router.
 * @param entities  Canonical names already in application state, if any.
 */
export function resolvePageTitle(
  pathname: string,
  entities: PageTitleEntities = {},
): ResolvedPageTitle {
  const path =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const done = (title: string): ResolvedPageTitle => ({
    title,
    isPending: false,
  });
  const pending = (title: string): ResolvedPageTitle => ({
    title,
    isPending: true,
  });

  // --- outside a workspace --------------------------------------------------
  const rootStatic = ROOT_STATIC_TITLES[path];
  if (rootStatic) return done(rootStatic);
  if (match('/invite/:token', path)) return done('Join a workspace');

  const wsMatch = matchPath(WS_PREFIX, path);
  if (!wsMatch) return done('');

  const base = `/w/${wsMatch.params.workspaceSlug}`;
  const sub = path.slice(base.length); // '', '/c/foo', '/settings/appearance', …

  // Settings has its own layout, mounted outside the app shell.
  if (sub === '/settings' || sub.startsWith('/settings/')) return done('Settings');

  // --- dynamic, entity-backed routes ------------------------------------
  if (match(`${base}/c/:channelSlug`, path)) {
    return entities.channel
      ? done(
          formatChannelName(entities.channel.name, {
            isPrivate: entities.channel.isPrivate,
          }),
        )
      : pending('Channel');
  }

  if (match(`${base}/dms/:peerId`, path)) {
    return entities.dmPeerName
      ? done(entities.dmPeerName)
      : pending('Direct message');
  }

  if (
    match(`${base}/tasks/:projectId`, path) ||
    match(`${base}/projects/:projectId`, path)
  ) {
    return entities.projectName
      ? done(entities.projectName)
      : pending('Project');
  }

  if (match(`${base}/agents/:agentId/chat`, path)) {
    return entities.agentName ? done(entities.agentName) : pending('AI Agent');
  }

  if (match(`${base}/apps/:appId/chat`, path)) {
    return entities.appName ? done(entities.appName) : pending('App');
  }

  if (
    match(`${base}/docs/:docId`, path) ||
    match(`${base}/notes/:docId`, path)
  ) {
    return entities.docTitle ? done(entities.docTitle) : pending('Document');
  }

  // --- fixed workspace routes -----------------------------------------
  const staticTitle = WORKSPACE_STATIC_TITLES[sub];
  if (staticTitle) return done(staticTitle);

  // --- unknown sub-route: the workspace itself is the best context ----
  return done(entities.workspaceName ?? '');
}
