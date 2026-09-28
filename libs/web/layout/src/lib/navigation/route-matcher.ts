/**
 * Route matching helper for data-driven navigation items.
 *
 * Supports exact paths, nested child routes, alternative aliases (e.g. /tasks & /kanban),
 * and query string matching where appropriate.
 */
export function isRouteActive(
  itemHref: string,
  pathname: string,
  workspaceSlug: string,
): boolean {
  const basePath = `/w/${workspaceSlug}`;
  const targetPath = itemHref ? `${basePath}/${itemHref}` : basePath;

  // 1. Exact match
  if (pathname === targetPath) {
    return true;
  }

  // 2. Root / Home special case
  if (itemHref === '' || itemHref === 'home') {
    return (
      pathname === basePath ||
      pathname === `${basePath}/` ||
      pathname === `${basePath}/home`
    );
  }

  // 3. Known aliases & hierarchical prefixes
  if (itemHref === 'tasks') {
    return (
      pathname.startsWith(`${basePath}/tasks`) ||
      pathname.startsWith(`${basePath}/kanban`) ||
      pathname.startsWith(`${basePath}/projects`) ||
      pathname.startsWith(`${basePath}/work`) ||
      pathname.startsWith(`${basePath}/cycles`) ||
      pathname.startsWith(`${basePath}/intake`) ||
      pathname.startsWith(`${basePath}/initiatives`)
    );
  }

  if (itemHref === 'docs') {
    return (
      pathname.startsWith(`${basePath}/docs`) ||
      pathname.startsWith(`${basePath}/notes`)
    );
  }

  // The AI Workspace also owns the legacy entry points that redirect into it.
  if (itemHref === 'ai') {
    return (
      pathname.startsWith(`${basePath}/ai/`) ||
      pathname.startsWith(`${basePath}/automations`) ||
      pathname.startsWith(`${basePath}/studio`) ||
      pathname === `${basePath}/agents` ||
      pathname.startsWith(`${basePath}/agents/builder`)
    );
  }

  if (itemHref === 'integrations') {
    return (
      pathname.startsWith(`${basePath}/integrations`) ||
      pathname.startsWith(`${basePath}/apps`)
    );
  }

  if (itemHref === 'directory') {
    return (
      pathname.startsWith(`${basePath}/directory`) ||
      pathname.startsWith(`${basePath}/members`) ||
      pathname.startsWith(`${basePath}/invitations`)
    );
  }

  if (itemHref === 'ai-chat') {
    return pathname.startsWith(`${basePath}/ai-chat`);
  }

  // 4. Default prefix check for nested subroutes
  return pathname.startsWith(`${targetPath}/`);
}
