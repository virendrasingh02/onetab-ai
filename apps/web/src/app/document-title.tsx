import { queryKeys } from '@org/api-client';
import {
  ChannelVisibility,
  type AIAgentDetail,
  type ChannelSummary,
  type ExternalIntegration,
  type Project,
  type PublicUser,
  type WorkDocument,
  type WorkspaceMember,
  type WorkspaceSummary,
} from '@org/types';
import { skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import {
  formatDocumentTitle,
  resolvePageTitle,
  type PageTitleEntities,
} from './page-title';

/**
 * Keeps `document.title` in step with the current location.
 *
 * Mounted once, above `<Routes>` in `app.tsx`, so a single derivation covers
 * every screen — sidebar navigation, channel/DM/project/agent switching,
 * browser back/forward, deep links and refresh alike — and no page sets its
 * own title. The contextual title comes from {@link resolvePageTitle}; the
 * canonical resource names it needs are read straight from the TanStack Query
 * cache the feature screens already populate.
 *
 * The reads below are cache-only: `queryFn: skipToken` subscribes an observer
 * that re-renders when a list or record changes (so renaming a channel updates
 * the tab with no reload) but never issues a request of its own. When a deep
 * link lands before its screen has fetched, the title shows a safe placeholder
 * and upgrades to the real name the moment it arrives.
 *
 * The desktop shell mirrors `document.title` onto the OS window title
 * automatically, so this is the shared implementation for web and Electron.
 */
export function DocumentTitle(): null {
  const { pathname } = useLocation();

  const workspaceSlug =
    matchPath({ path: '/w/:workspaceSlug', end: false }, pathname)?.params
      .workspaceSlug ?? '';

  // Route params for the dynamic, entity-backed screens. Patterns and matcher
  // options mirror `resolvePageTitle` so the two always agree on the route.
  const params = useMemo(() => {
    const grab = (pattern: string, key: string) =>
      matchPath({ path: pattern, end: false }, pathname)?.params[key];
    return {
      channelSlug: grab('/w/:workspaceSlug/c/:channelSlug', 'channelSlug'),
      peerId: grab('/w/:workspaceSlug/dms/:peerId', 'peerId'),
      projectId:
        grab('/w/:workspaceSlug/projects/:projectId', 'projectId') ??
        grab('/w/:workspaceSlug/tasks/:projectId', 'projectId'),
      agentId: grab('/w/:workspaceSlug/agents/:agentId/chat', 'agentId'),
      appId: grab('/w/:workspaceSlug/apps/:appId/chat', 'appId'),
      docId:
        grab('/w/:workspaceSlug/docs/:docId', 'docId') ??
        grab('/w/:workspaceSlug/notes/:docId', 'docId'),
    };
  }, [pathname]);

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceSlug),
    queryFn: skipToken,
  });
  const workspace = workspaceQuery.data as WorkspaceSummary | undefined;
  const workspaceId = workspace?.id ?? '';

  const [channels, members, agents, integrations, projectList, docList] =
    useQueries({
      queries: [
        { queryKey: queryKeys.channels.list(workspaceId, false), queryFn: skipToken },
        { queryKey: queryKeys.members.list(workspaceId), queryFn: skipToken },
        { queryKey: queryKeys.agents.list(workspaceId), queryFn: skipToken },
        { queryKey: queryKeys.integrations.list(workspaceId), queryFn: skipToken },
        { queryKey: queryKeys.workTools.projects(workspaceId), queryFn: skipToken },
        { queryKey: queryKeys.workTools.documents(workspaceId), queryFn: skipToken },
      ],
    });

  const entities = useMemo<PageTitleEntities>(() => {
    const result: PageTitleEntities = { workspaceName: workspace?.name };

    if (params.channelSlug) {
      const hit = (channels.data as ChannelSummary[] | undefined)?.find(
        (channel) => channel.slug === params.channelSlug,
      );
      if (hit) {
        result.channel = {
          name: hit.name,
          isPrivate: hit.visibility === ChannelVisibility.PRIVATE,
        };
      }
    }

    if (params.peerId) {
      result.dmPeerName = resolvePeerName(
        params.peerId,
        members.data as WorkspaceMember[] | undefined,
        agents.data as AIAgentDetail[] | undefined,
        integrations.data as ExternalIntegration[] | undefined,
      );
    }

    if (params.projectId) {
      result.projectName = (
        projectList.data as Project[] | undefined
      )?.find((entry) => entry.id === params.projectId)?.name;
    }

    if (params.agentId) {
      result.agentName = (
        agents.data as AIAgentDetail[] | undefined
      )?.find((agent) => agent.id === params.agentId)?.name;
    }

    if (params.appId) {
      result.appName = resolveAppName(
        params.appId,
        integrations.data as ExternalIntegration[] | undefined,
      );
    }

    if (params.docId) {
      result.docTitle = (
        docList.data as WorkDocument[] | undefined
      )?.find((entry) => entry.id === params.docId)?.title;
    }

    return result;
  }, [
    params,
    workspace?.name,
    channels.data,
    members.data,
    agents.data,
    integrations.data,
    projectList.data,
    docList.data,
  ]);

  const { title } = useMemo(
    () => resolvePageTitle(pathname, entities),
    [pathname, entities],
  );

  useEffect(() => {
    document.title = formatDocumentTitle(title);
  }, [title]);

  return null;
}

/** `displayName` when set, otherwise the plain `name`. */
function personName(user: Pick<PublicUser, 'displayName' | 'name'>): string {
  return user.displayName?.trim() || user.name;
}

/** `github` → `Github`, `google_drive` → `Google Drive`. Fallback only. */
function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A DM peer id is a member's user id, or `agent-<id>` / `app-<id>` for the
 * agents and connected apps `DirectMessagesPage` folds into the picker.
 */
function resolvePeerName(
  peerId: string,
  members: WorkspaceMember[] | undefined,
  agents: AIAgentDetail[] | undefined,
  integrations: ExternalIntegration[] | undefined,
): string | undefined {
  if (peerId.startsWith('agent-')) {
    const id = peerId.slice('agent-'.length);
    return agents?.find((agent) => agent.id === id)?.name;
  }
  if (peerId.startsWith('app-')) {
    return integrationName(
      integrations?.find((entry) => entry.id === peerId.slice('app-'.length)),
    );
  }
  const member = members?.find((entry) => entry.user.id === peerId);
  return member ? personName(member.user) : undefined;
}

/** The app route param is a provider slug, an integration id, or `app-<id>`. */
function resolveAppName(
  appId: string,
  integrations: ExternalIntegration[] | undefined,
): string | undefined {
  const target = appId.toLowerCase();
  return integrationName(
    integrations?.find(
      (entry) =>
        entry.id.toLowerCase() === target ||
        entry.provider.toLowerCase() === target ||
        `app-${entry.id}`.toLowerCase() === target,
    ),
  );
}

function integrationName(
  entry: ExternalIntegration | undefined,
): string | undefined {
  if (!entry) return undefined;
  return entry.displayName?.trim() || titleCase(entry.provider);
}
