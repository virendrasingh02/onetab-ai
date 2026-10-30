/**
 * Maps the web app's workspace-relative deep links onto mobile routes.
 *
 * Notifications store links relative to `/w/:slug/` (`c/general`,
 * `ai/runs?run=…`, `settings/billing`) because that is what the web bell opens.
 * The push payload carries the same string, so a tap here has to translate it.
 * Unknown or unhandled links land on the notification list rather than nowhere.
 */
export interface MobileRoute {
  pathname: string;
  params?: Record<string, string>;
}

const FALLBACK: MobileRoute = { pathname: '/notifications' };

export function parseRelativeLink(link: string): {
  path: string[];
  query: URLSearchParams;
} {
  const trimmed = link.trim().replace(/^\/+/, '');
  const [pathPart = '', queryPart = ''] = trimmed.split('?', 2);
  const path = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return { path, query: new URLSearchParams(queryPart) };
}

export function routeForDeepLink(link: string | null | undefined): MobileRoute {
  if (!link) return FALLBACK;

  // Absolute web URLs (`https://app/w/acme/c/general`) and our own scheme
  // (`onetab://w/acme/c/general`) both carry the workspace prefix.
  let relative = link;
  const web = /^https?:\/\/[^/]*(\/.*)?$/i.exec(link);
  const custom = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(link);
  // For a web URL the first segment is the host; for `onetab://w/…` it is
  // already part of the path.
  if (web) relative = web[1] ?? '';
  else if (custom) relative = custom[1] ?? '';
  relative = relative.replace(/^\/?w\/[^/]+\/?/, '');

  const { path, query } = parseRelativeLink(relative);
  const [head, second] = path;

  switch (head) {
    case 'home':
    case 'dashboard':
    case 'overview':
      return { pathname: '/' };
    case 'c':
    case 'channels':
      return second
        ? { pathname: '/channel/[slug]', params: { slug: second } }
        : { pathname: '/chat' };
    case 'dms': {
      // The web opens a DM at `dms?room=<roomId>` or `dms?user=<userId>` or `dms/:peerId`.
      const roomId = query.get('room');
      if (roomId) return { pathname: '/dm/[roomId]', params: { roomId } };
      const user = query.get('user') ?? second;
      if (user) return { pathname: '/dm/new', params: { user } };
      return { pathname: '/chat', params: { tab: 'dms' } };
    }
    case 'threads':
      return { pathname: '/chat' };
    case 'search':
      return { pathname: '/search' };
    case 'ai': {
      if (second === 'chat' || second === 'assistant') {
        return { pathname: '/ai/chat' };
      }
      if (second === 'writer') {
        return { pathname: '/ai/writer' };
      }
      if (second === 'images' || second === 'image-generator') {
        return { pathname: '/ai/images' };
      }
      if (second === 'runs' || second === 'executions') {
        const run = query.get('run');
        return { pathname: '/executions', params: run ? { run } : {} };
      }
      if (second === 'approvals') return { pathname: '/approvals' };
      if (second === 'agents' && path[2]) {
        return { pathname: '/agent/[agentId]', params: { agentId: path[2] } };
      }
      return { pathname: '/agents' };
    }
    case 'writer':
      return { pathname: '/ai/writer' };
    case 'images':
      return { pathname: '/ai/images' };
    case 'knowledge': {
      const kbId = query.get('kbId') ?? second;
      return kbId
        ? { pathname: '/knowledge/[kbId]', params: { kbId } }
        : { pathname: '/knowledge' };
    }
    case 'admin':
      return { pathname: '/admin' };
    case 'agents': {
      if (second) {
        if (path[2] === 'chat' || second === 'chat') {
          const agentId = second === 'chat' ? (path[2] ?? '') : second;
          return agentId
            ? { pathname: '/agent/[agentId]/chat', params: { agentId } }
            : { pathname: '/agents' };
        }
        return { pathname: '/agent/[agentId]', params: { agentId: second } };
      }
      return { pathname: '/agents' };
    }
    case 'approvals':
      return { pathname: '/approvals' };
    case 'coworkers': {
      const coworkerId = query.get('coworkerId') ?? second;
      return coworkerId
        ? { pathname: '/coworker/[coworkerId]', params: { coworkerId } }
        : { pathname: '/agents' };
    }
    case 'tasks':
    case 'kanban':
    case 'projects':
    case 'work': {
      const taskId = query.get('taskId') ?? second;
      return taskId
        ? { pathname: '/tasks/[taskId]', params: { taskId } }
        : { pathname: '/tasks' };
    }
    case 'documents':
    case 'docs':
    case 'notes': {
      const docId = query.get('docId') ?? second;
      return docId
        ? { pathname: '/documents/[docId]', params: { docId } }
        : { pathname: '/documents' };
    }
    case 'meetings':
    case 'calendar': {
      const meetingId = query.get('meetingId') ?? second;
      return meetingId
        ? { pathname: '/meetings/[meetingId]', params: { meetingId } }
        : { pathname: '/meetings' };
    }
    case 'timesheet':
    case 'attendance':
      return { pathname: '/timesheet' };
    case 'studio': {
      const workflowId = query.get('workflowId') ?? second;
      return {
        pathname: '/automation/studio',
        params: workflowId ? { workflowId } : {},
      };
    }
    case 'automations':
    case 'workflows': {
      if (second === 'studio') {
        const workflowId = path[2] ?? query.get('workflowId');
        return {
          pathname: '/automation/studio',
          params: workflowId ? { workflowId } : {},
        };
      }
      // The web builder lives at `automations/builder/:id`.
      const workflowId = second === 'builder' ? path[2] : second;
      return workflowId
        ? { pathname: '/automation/[workflowId]', params: { workflowId } }
        : { pathname: '/updates' };
    }
    case 'profile':
      return { pathname: '/profile' };
    case 'settings':
      if (second === 'billing') return { pathname: '/billing' };
      if (second === 'integrations') return { pathname: '/integrations' };
      if (second === 'notifications') return { pathname: '/settings' };
      return { pathname: '/settings' };
    case 'billing':
      return { pathname: '/billing' };
    case 'integrations':
    case 'connectors':
      return { pathname: '/integrations' };
    case 'directory':
    case 'members':
      return { pathname: '/team' };
    case 'analytics':
      return { pathname: '/analytics' };
    case 'files':
      return { pathname: '/files' };
    case 'inbox':
    case 'notifications':
      return FALLBACK;
    default:
      return FALLBACK;
  }
}

/** The workspace slug in an absolute or `w/:slug/…` link, if it has one. */
export function workspaceSlugOf(
  link: string | null | undefined,
): string | null {
  if (!link) return null;
  const match = /(?:^|\/)w\/([^/?#]+)/.exec(link);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
