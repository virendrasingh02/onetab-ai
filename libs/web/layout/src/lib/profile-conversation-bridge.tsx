import {
  ProfileConversationProvider,
  type OpenProfileConversation,
} from '@org/chat-ui';
import { toPlatformUserId } from '@org/types';
import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/** Sends a profile card's message action to that entity's own conversation. */
export function ProfileConversationBridge({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  const open = useCallback<OpenProfileConversation>(
    ({ userId, entityKind, entityId }) => {
      // Message senders carry a Matrix id; the routes resolve platform ids.
      const platformId = toPlatformUserId(userId);
      const prefix = /^(agent|app|coworker)-/.exec(platformId);
      const kind = entityKind ?? prefix?.[1] ?? 'user';
      const id =
        entityId ?? (prefix ? platformId.slice(prefix[0].length) : platformId);
      const base = `/w/${workspaceSlug}`;

      if (kind === 'agent') navigate(`${base}/agents/chat?id=${id}`);
      else if (kind === 'app') navigate(`${base}/apps?app=${id}`);
      else if (kind === 'coworker') navigate(`${base}/coworkers/${id}`);
      else navigate(`${base}/dms/${platformId}`);
    },
    [navigate, workspaceSlug],
  );

  return (
    <ProfileConversationProvider value={open}>
      {children}
    </ProfileConversationProvider>
  );
}
