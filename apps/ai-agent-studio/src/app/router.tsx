import { forwardRef, useCallback } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  Navigate as RouterNavigate,
  useNavigate as useRouterNavigate,
  type LinkProps,
  type NavigateProps,
  type NavigateOptions,
  type NavLinkProps,
  type To,
} from 'react-router-dom';

import { useStudioSession } from './session-guard.js';

export {
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

/**
 * Every Studio page lives under `/w/:workspaceSlug/ai`. Pages write short
 * app-relative paths (`/connectors`, `/agents/:id`); this resolves them to the
 * one canonical, workspace-scoped URL so the address bar never carries two
 * spellings of the same page.
 */
export const STUDIO_ROOT = '/w/:workspaceSlug/ai';

/** First path segment → canonical segment (the plan-first `agents` library owns that name). */
const SEGMENT_ALIASES: Record<string, string> = {
  agents: 'my-agents',
  overview: '',
};

export function scopeStudioPath(slug: string, path: string): string {
  if (!path.startsWith('/') || path.startsWith('/w/')) return path;
  const match = /^\/([^/?#]*)(.*)$/s.exec(path);
  const segment = match?.[1] ?? '';
  const rest = match?.[2] ?? '';
  const mapped = segment in SEGMENT_ALIASES ? SEGMENT_ALIASES[segment] : segment;
  return `/w/${slug}/ai${mapped ? `/${mapped}` : ''}${rest}`;
}

function scopeTo(slug: string, to: To): To {
  if (typeof to === 'string') return scopeStudioPath(slug, to);
  return to.pathname ? { ...to, pathname: scopeStudioPath(slug, to.pathname) } : to;
}

/** Studio pages that have no workspace-scoped spelling yet (legacy, un-prefixed URLs). */
export const LEGACY_SEGMENTS = new Set([
  'agents',
  'coworkers',
  'chat',
  'create',
  'workflows',
  'templates',
  'executions',
  'connectors',
  'widgets',
  'tools',
  'mcp',
  'knowledge',
  'analytics',
  'settings',
  'developer',
  'overview',
]);

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function StudioLink({ to, ...props }, ref) {
  const { activeWorkspace } = useStudioSession();
  return <RouterLink ref={ref} to={scopeTo(activeWorkspace.slug, to)} {...props} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function StudioNavLink(
  { to, ...props },
  ref,
) {
  const { activeWorkspace } = useStudioSession();
  return <RouterNavLink ref={ref} to={scopeTo(activeWorkspace.slug, to)} {...props} />;
});

export function Navigate({ to, ...props }: NavigateProps) {
  const { activeWorkspace } = useStudioSession();
  return <RouterNavigate to={scopeTo(activeWorkspace.slug, to)} {...props} />;
}

export function useNavigate() {
  const navigate = useRouterNavigate();
  const { activeWorkspace } = useStudioSession();
  const slug = activeWorkspace.slug;
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') return navigate(to);
      return navigate(scopeTo(slug, to), options);
    },
    [navigate, slug],
  ) as typeof navigate;
}
