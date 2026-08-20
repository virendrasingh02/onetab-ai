import type { Message, Presence, RoomId, RoomMember } from '@org/matrix-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

interface ChatState {
  messages: Message[];
  members: RoomMember[];
  typingUserIds: string[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  error: string | null;
}

/**
 * Live view of one room.
 *
 * State is kept in a reducer-like local store rather than TanStack Query: a
 * Matrix timeline is a push stream, not a cache to invalidate, and modelling
 * it as a query would mean refetching a room every time an event arrives.
 */
export function useRoom(roomId: RoomId | undefined) {
  const { client } = useMatrix();
  const [state, setState] = useState<ChatState>({
    messages: [],
    members: [],
    typingUserIds: [],
    isLoading: true,
    isLoadingOlder: false,
    hasMore: false,
    error: null,
  });

  // Initial load whenever the room changes.
  useEffect(() => {
    if (!client || !roomId) {
      setState((current) => ({ ...current, isLoading: !!roomId }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const timeline = client.getTimeline(roomId);
      const members = client.getMembers(roomId);
      if (cancelled) return;

      setState({
        messages: timeline.messages,
        members,
        typingUserIds: [],
        isLoading: false,
        isLoadingOlder: false,
        hasMore: timeline.hasMore,
        error: null,
      });
    } catch (error) {
      if (!cancelled) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load.',
        }));
      }
    }

    return () => {
      cancelled = true;
    };
  }, [client, roomId]);

  // Live updates.
  useEffect(() => {
    if (!client || !roomId) return;

    return client.on((event) => {
      switch (event.type) {
        case 'message.received':
          if (event.message.roomId !== roomId) return;
          setState((current) =>
            // The SDK can replay an event; never append a duplicate.
            current.messages.some((m) => m.id === event.message.id)
              ? current
              : { ...current, messages: [...current.messages, event.message] },
          );
          break;

        case 'message.updated':
          if (event.message.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === event.message.id ? event.message : message,
            ),
          }));
          break;

        case 'message.redacted':
          if (event.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === event.eventId
                ? { ...message, isRedacted: true, body: '' }
                : message,
            ),
          }));
          break;

        case 'typing':
          if (event.update.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            typingUserIds: event.update.userIds,
          }));
          break;

        default:
          break;
      }
    });
  }, [client, roomId]);

  const loadOlder = useCallback(async () => {
    if (!client || !roomId) return;
    setState((current) => ({ ...current, isLoadingOlder: true }));

    try {
      const page = await client.loadOlderMessages(roomId);
      setState((current) => ({
        ...current,
        // Prepend: this page is older than everything already loaded.
        messages: [...page.messages, ...current.messages],
        hasMore: page.hasMore,
        isLoadingOlder: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingOlder: false,
        error: error instanceof Error ? error.message : 'Failed to load more.',
      }));
    }
  }, [client, roomId]);

  const typingNames = useMemo(
    () =>
      state.typingUserIds.map(
        (userId) =>
          state.members.find((member) => member.userId === userId)
            ?.displayName ?? userId,
      ),
    [state.typingUserIds, state.members],
  );

  return { ...state, typingNames, loadOlder };
}

function getMentionedBotReply(
  body: string,
): { senderId: string; senderName: string; body: string } | null {
  const lower = body.toLowerCase();
  if (lower.includes('@copilot') || lower.includes('@assistant')) {
    return {
      senderId: 'agent-copilot',
      senderName: 'OneTab Copilot',
      body: `I analyzed your message in this channel.\n\n- **Status**: Request processed with active channel context.\n- **Action**: All thread items and workspace resources are synchronized.\n\nLet me know if you would like me to draft changes or generate a summary!`,
    };
  }
  if (lower.includes('@codereview') || lower.includes('@review')) {
    return {
      senderId: 'agent-code-reviewer',
      senderName: 'Code Reviewer AI',
      body: `**Code Review & AST Inspection**: ✅ Passed with 0 security warnings.\n\n\`\`\`tsx\n// Suggested optimization for state stability:\nconst memoizedValue = useMemo(() => compute(), [compute]);\n\`\`\`\n- **Complexity**: Low\n- **Security Audit**: 100% Pass`,
    };
  }
  if (lower.includes('@triage') || lower.includes('@incident')) {
    return {
      senderId: 'agent-triage',
      senderName: 'Incident & Bug Triage',
      body: `🚨 **Incident & Error Triage Status**:\n- **Active P0 Incidents**: 0\n- **Error Rate**: <0.01% (Healthy)\n- **Services**: 🟢 All microservices operational.`,
    };
  }
  if (lower.includes('@standup')) {
    return {
      senderId: 'agent-standup',
      senderName: 'Daily Standup Bot',
      body: `📋 **Daily Standup Summary**:\n- **Completed**: Unified in-channel mentions for AI agents and Apps.\n- **In Progress**: Real-time bot badges & message row designs.\n- **Blockers**: None.`,
    };
  }
  if (lower.includes('@docs') || lower.includes('@doc')) {
    return {
      senderId: 'agent-docs',
      senderName: 'Docs & Knowledge AI',
      body: `📝 **Knowledge Base Update**: Synthesized channel conclusion and updated workspace documentation.`,
    };
  }
  if (lower.includes('@data') || lower.includes('@sql')) {
    return {
      senderId: 'agent-sql-analyst',
      senderName: 'SQL & Data Analyst',
      body: `📊 **Analytics Query Result**:\n\`\`\`sql\nSELECT channel_name, count(messages) FROM channel_stats GROUP BY channel_name;\n\`\`\`\n- Real-time telemetry events recorded.`,
    };
  }
  if (lower.includes('@github-app') || lower.includes('@github')) {
    return {
      senderId: 'app-github',
      senderName: 'GitHub',
      body: `🐙 **GitHub Pull Request Update**:\n- **PR #248**: *feat(channels): Unified AI agent & app mentions in chat*\n- **Checks**: ✅ 14/14 checks passing\n- **Review**: Approved by Lead Architect`,
    };
  }
  if (lower.includes('@linear-bot') || lower.includes('@linear')) {
    return {
      senderId: 'app-linear',
      senderName: 'Linear',
      body: `📐 **Linear Issue Sync**:\n- **Issue ENG-1082**: *Real-time agent and app mentions in same row*\n- **Status**: ⚡ In Review (Sprint 24)`,
    };
  }
  if (lower.includes('@sentry-bot') || lower.includes('@sentry')) {
    return {
      senderId: 'app-sentry',
      senderName: 'Sentry Error Monitor',
      body: `🚨 **Sentry Monitoring**:\n- **Environment**: Production\n- **Status**: Issue resolved. 0 uncaught exceptions recorded.`,
    };
  }
  if (lower.includes('@jira-bot') || lower.includes('@jira')) {
    return {
      senderId: 'app-jira',
      senderName: 'Jira Software',
      body: `🔷 **Jira Sprint Status**: Sprint 24 is currently 85% completed. 18 story points resolved.`,
    };
  }
  if (lower.includes('@figma-bot') || lower.includes('@figma')) {
    return {
      senderId: 'app-figma',
      senderName: 'Figma',
      body: `🎨 **Figma Notification**: UI component designs for Unified Messages synchronized with design system.`,
    };
  }
  if (lower.includes('@gdrive-bot') || lower.includes('@gdrive')) {
    return {
      senderId: 'app-gdrive',
      senderName: 'Google Drive',
      body: `📁 **Google Drive**: Linked document and synchronized assets to channel storage.`,
    };
  }
  return null;
}

function getDirectPeerReply(
  roomId: string,
  body: string,
): { senderId: string; senderName: string; body: string } | null {
  if (roomId.includes('agent-copilot')) {
    return {
      senderId: 'agent-copilot',
      senderName: 'OneTab Copilot',
      body: `I received your direct message: "${body}"\n\n- **Analysis**: Running OneTab Copilot engine.\n- **Status**: Ready to assist with codebase search, channel tasks, or workflow generation.`,
    };
  }
  if (roomId.includes('agent-codereview')) {
    return {
      senderId: 'agent-code-reviewer',
      senderName: 'Code Reviewer AI',
      body: `**Code Review Assistant**: Analyzing your input.\n\n\`\`\`tsx\n// Verified code stability and type safety\nconst result = await runAudit();\n\`\`\`\n- **Status**: No vulnerabilities found.`,
    };
  }
  if (roomId.includes('agent-triage')) {
    return {
      senderId: 'agent-triage',
      senderName: 'Incident & Bug Triage',
      body: `🚨 **Direct SRE Triage**: Monitoring system logs and exception metrics. 0 P0 incidents recorded.`,
    };
  }
  if (roomId.includes('agent-standup')) {
    return {
      senderId: 'agent-standup',
      senderName: 'Daily Standup Bot',
      body: `📋 **Standup Assistant**: Logged your async daily update. I'll include this in the next channel recap!`,
    };
  }
  if (roomId.includes('agent-docs')) {
    return {
      senderId: 'agent-docs',
      senderName: 'Docs & Knowledge AI',
      body: `📝 **Knowledge Assistant**: Synced direct inquiry with workspace documentation and internal guides.`,
    };
  }
  if (roomId.includes('agent-data')) {
    return {
      senderId: 'agent-sql-analyst',
      senderName: 'SQL & Data Analyst',
      body: `📊 **SQL Analyst**: Metric query generated for your direct prompt. All databases online.`,
    };
  }
  if (roomId.includes('app-github')) {
    return {
      senderId: 'app-github',
      senderName: 'GitHub',
      body: `🐙 **GitHub Direct**: Repository sync active. All pull requests, CI runs, and webhooks are operational.`,
    };
  }
  if (roomId.includes('app-linear')) {
    return {
      senderId: 'app-linear',
      senderName: 'Linear',
      body: `📐 **Linear Direct**: Synced with Linear workspace. Current active issues are tracked in Sprint 24.`,
    };
  }
  if (roomId.includes('app-sentry')) {
    return {
      senderId: 'app-sentry',
      senderName: 'Sentry Error Monitor',
      body: `🚨 **Sentry Direct**: Crash reporting stream active. 0 active alerts in current environment.`,
    };
  }
  if (roomId.includes('app-jira')) {
    return {
      senderId: 'app-jira',
      senderName: 'Jira Software',
      body: `🔷 **Jira Direct**: Sprint board status loaded. 18 story points closed.`,
    };
  }
  if (roomId.includes('app-figma')) {
    return {
      senderId: 'app-figma',
      senderName: 'Figma',
      body: `🎨 **Figma Direct**: Design file connected. Comments and frames synced.`,
    };
  }
  if (roomId.includes('app-gdrive')) {
    return {
      senderId: 'app-gdrive',
      senderName: 'Google Drive',
      body: `📁 **Google Drive Direct**: Cloud files accessible and indexed.`,
    };
  }
  return null;
}

/** Message actions for a room, with the room id already bound. */
export function useRoomActions(roomId: RoomId | undefined) {
  const { client } = useMatrix();

  const send = useCallback(
    async (body: string, threadRootId?: string) => {
      if (!client || !roomId) return;
      await client.sendMessage(roomId, body, { threadRootId });

      const isDirectBot =
        roomId.startsWith('!dm-agent-') || roomId.startsWith('!dm-app-');
      const botReply = isDirectBot
        ? getDirectPeerReply(roomId, body)
        : getMentionedBotReply(body);

      if (botReply) {
        setTimeout(() => {
          const botMessage: Message = {
            id: `msg-bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            roomId,
            senderId: botReply.senderId,
            senderName: botReply.senderName,
            senderAvatarUrl: undefined,
            body: botReply.body,
            timestamp: Date.now(),
            isEncrypted: false,
            reactions: [],
            threadRootId,
          };
          client.emit({ type: 'message.received', message: botMessage });
        }, 500);
      }
    },
    [client, roomId],
  );

  const edit = useCallback(
    async (eventId: string, body: string) => {
      if (!client || !roomId) return;
      await client.editMessage(roomId, eventId, body);
    },
    [client, roomId],
  );

  const remove = useCallback(
    async (eventId: string) => {
      if (!client || !roomId) return;
      await client.deleteMessage(roomId, eventId);
    },
    [client, roomId],
  );

  /** Adds the reaction, or removes it when the user already reacted. */
  const toggleReaction = useCallback(
    async (eventId: string, key: string, alreadyReacted: boolean) => {
      if (!client || !roomId) return;
      if (alreadyReacted) {
        await client.removeReaction(roomId, eventId, key);
      } else {
        await client.react(roomId, eventId, key);
      }
    },
    [client, roomId],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!client || !roomId) return;
      void client.setTyping(roomId, isTyping);
    },
    [client, roomId],
  );

  const markRead = useCallback(
    (eventId: string) => {
      if (!client || !roomId) return;
      void client.markRead(roomId, eventId);
    },
    [client, roomId],
  );

  const attach = useCallback(
    async (files: FileList, threadRootId?: string) => {
      if (!client || !roomId) return;
      for (const file of Array.from(files)) {
        await client.sendFile(roomId, file, { threadRootId });
      }
    },
    [client, roomId],
  );

  return { send, edit, remove, toggleReaction, setTyping, markRead, attach };
}

export function usePresence(userIds: string[]) {
  const { client } = useMatrix();
  const [presence, setPresence] = useState<Record<string, Presence>>({});

  useEffect(() => {
    if (!client) return;

    setPresence(
      Object.fromEntries(
        userIds.map((userId) => [userId, client.getPresence(userId)]),
      ),
    );

    return client.on((event) => {
      if (event.type !== 'presence') return;
      setPresence((current) => ({
        ...current,
        [event.presence.userId]: event.presence,
      }));
    });
    // `userIds` is a new array each render; join it so the effect is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, userIds.join(',')]);

  return useCallback(
    (userId: string) => presence[userId]?.state ?? 'offline',
    [presence],
  );
}
