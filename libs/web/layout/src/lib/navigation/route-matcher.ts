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

  if (itemHref === 'agents') {
    return pathname.startsWith(`${basePath}/agents`);
  }

  if (itemHref === 'automations') {
    return pathname.startsWith(`${basePath}/automations`);
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

  if (itemHref === 'ai/prompts') {
    return pathname.startsWith(`${basePath}/ai/prompts`);
  }

  if (itemHref === 'ai/images') {
    return pathname.startsWith(`${basePath}/ai/images`);
  }

  if (itemHref === 'cards') {
    return pathname.startsWith(`${basePath}/cards`);
  }

  // 4. Default prefix check for nested subroutes
  return pathname.startsWith(`${targetPath}/`);
}
