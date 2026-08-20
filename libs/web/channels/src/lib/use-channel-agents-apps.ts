import { useCallback, useEffect, useState } from 'react';
import { toast } from '@org/ui';
import {
  type ChannelAIAgent,
  type ChannelConnectedApp,
  type ChannelBotMessage,
  PRESET_AI_AGENTS,
  PRESET_CHANNEL_APPS,
} from './types/channel-agents-apps.js';

function createInitialMessages(channelId: string): ChannelBotMessage[] {
  const now = Date.now();
  return [
    {
      id: `msg-bot-copilot-${channelId}`,
      channelId,
      senderType: 'agent',
      senderId: 'agent-copilot',
      senderName: 'OneTab Copilot',
      senderHandle: '@copilot',
      senderAvatarSeed: 'copilot',
      badgeLabel: 'AI AGENT',
      badgeVariant: 'primary',
      model: 'Gemini 2.5 Pro',
      timestamp: now - 1000 * 60 * 42,
      replyToHandle: '@virendra',
      content: `I analyzed the recent channel thread regarding real-time websocket synchronization and AI agent activity. Here is an optimized plan with driver adapters and persistent state:

1. **State Persistence**: Synced via local cache with immediate optimistic update.
2. **Telemetry Stream**: Live events piped through the Matrix channel room.
3. **Execution Latency**: Average response time reduced to ~180ms.`,
      reasoning: {
        summary: 'Deep context analysis on channel history & database schema',
        details:
          'Evaluated 47 messages in channel timeline. Checked schema relations for ChannelMembership, Integrations, and AgentRun logs. Formulated a 3-step recommendation.',
        durationMs: 420,
      },
      toolsExecuted: [
        {
          name: 'db.query("SELECT agent_id, status FROM channel_agents")',
          status: 'success',
          output: '2 active agents connected to this channel',
        },
        {
          name: 'rag.searchChannelMemory("websocket sync")',
          status: 'success',
          output: 'Found 4 relevant thread references',
        },
      ],
      actions: [
        {
          id: 'act-copilot-1',
          label: 'Apply Architecture Plan',
          variant: 'primary',
        },
        {
          id: 'act-copilot-2',
          label: 'Ask Follow-up',
          variant: 'outline',
        },
      ],
      feedback: {
        helpful: true,
        reactionCount: 4,
      },
    },
    {
      id: `msg-app-github-${channelId}`,
      channelId,
      senderType: 'app',
      senderId: 'app-github',
      senderName: 'GitHub',
      senderHandle: '@github-app',
      senderAvatarSeed: 'github',
      badgeLabel: 'APP',
      badgeVariant: 'violet',
      timestamp: now - 1000 * 60 * 25,
      content: 'New Pull Request submitted for review in `onetab-ai/core`:',
      embedCard: {
        type: 'github_pr',
        title: '#248 feat(channels): AI Agents & Apps interactive view and message feed',
        url: 'https://github.com/onetab-ai/onetab-ai/pull/248',
        accentColor: '#3b82f6',
        fields: [
          { label: 'Author', value: 'virendra02', inline: true },
          { label: 'Branch', value: 'feat/ai-agents-view → main', inline: true },
          { label: 'Status', value: '● CI Tests Passing (14/14)', inline: true },
          { label: 'Changes', value: '+420 lines · -18 lines (4 files)', inline: true },
        ],
        footer: 'GitHub Actions · Deployed preview at pr-248.onetab.dev',
      },
      actions: [
        {
          id: 'act-gh-1',
          label: 'Review Pull Request',
          variant: 'primary',
          url: 'https://github.com',
        },
        {
          id: 'act-gh-2',
          label: 'Approve & Merge',
          variant: 'secondary',
        },
      ],
    },
    {
      id: `msg-bot-code-review-${channelId}`,
      channelId,
      senderType: 'agent',
      senderId: 'agent-code-reviewer',
      senderName: 'Code Reviewer AI',
      senderHandle: '@codereview',
      senderAvatarSeed: 'codereview',
      badgeLabel: 'AI AGENT',
      badgeVariant: 'success',
      model: 'Claude 3.7 Sonnet',
      timestamp: now - 1000 * 60 * 18,
      content: `Automated code review completed for PR #248. **Security Audit: 100% Pass** ✅.

**Suggestion**: Wrap the state dispatcher in \`useCallback\` to prevent unnecessary re-renders in large channel member lists:`,
      codeBlock: {
        language: 'tsx',
        filename: 'channel-agents-view.tsx',
        isDiff: true,
        code: `- const handleTrigger = (id: string) => dispatch({ type: 'RUN', id });
+ const handleTrigger = useCallback((id: string) => {
+   dispatch({ type: 'RUN', id, timestamp: Date.now() });
+ }, [dispatch]);`,
      },
      toolsExecuted: [
        {
          name: 'ast.lintEngine.checkComplexity()',
          status: 'success',
          output: 'Complexity Score: A (Low cyclomatic complexity)',
        },
      ],
      actions: [
        {
          id: 'act-cr-1',
          label: 'Accept Diff Suggestion',
          variant: 'primary',
        },
        {
          id: 'act-cr-2',
          label: 'View Detailed Report',
          variant: 'outline',
        },
      ],
      feedback: {
        helpful: true,
        reactionCount: 6,
      },
    },
    {
      id: `msg-app-linear-${channelId}`,
      channelId,
      senderType: 'app',
      senderId: 'app-linear',
      senderName: 'Linear',
      senderHandle: '@linear-bot',
      senderAvatarSeed: 'linear',
      badgeLabel: 'APP',
      badgeVariant: 'violet',
      timestamp: now - 1000 * 60 * 8,
      content: 'Issue status moved to **In Progress**:',
      embedCard: {
        type: 'linear_issue',
        title: 'ENG-1082: Real-time agent event stream in channels',
        url: 'https://linear.app',
        accentColor: '#8b5cf6',
        fields: [
          { label: 'Priority', value: '⚡ High', inline: true },
          { label: 'Assignee', value: 'Virendra Singh', inline: true },
          { label: 'Estimate', value: '3 Points (Sprint 24)', inline: true },
          { label: 'Project', value: 'Q3 Channel Extensibility', inline: true },
        ],
        footer: 'Linear Sync Bot · Updated 8 minutes ago',
      },
      actions: [
        {
          id: 'act-linear-1',
          label: 'Open in Linear',
          variant: 'primary',
          url: 'https://linear.app',
        },
        {
          id: 'act-linear-2',
          label: 'Change Status',
          variant: 'outline',
        },
      ],
    },
    {
      id: `msg-app-sentry-${channelId}`,
      channelId,
      senderType: 'app',
      senderId: 'app-sentry',
      senderName: 'Sentry Error Monitor',
      senderHandle: '@sentry-bot',
      senderAvatarSeed: 'sentry',
      badgeLabel: 'MONITORING',
      badgeVariant: 'warning',
      timestamp: now - 1000 * 60 * 3,
      content: '🚨 **Production Warning**: Unhandled rejection caught in gateway listener:',
      embedCard: {
        type: 'sentry_alert',
        title: 'TypeError: Cannot read properties of undefined (reading "connectionToken")',
        url: 'https://sentry.io',
        accentColor: '#ef4444',
        fields: [
          { label: 'Culprit', value: 'libs/api/gateway/src/lib/socket.ts:84', inline: false },
          { label: 'Impact', value: '12 events · 3 users affected in us-east', inline: true },
          { label: 'Environment', value: 'production', inline: true },
        ],
        footer: 'Sentry Alerts · Auto-routed to #channel on-call',
      },
      actions: [
        {
          id: 'act-sentry-1',
          label: 'Acknowledge Alert',
          variant: 'primary',
        },
        {
          id: 'act-sentry-2',
          label: 'Assign to On-Call',
          variant: 'outline',
        },
      ],
    },
  ];
}

export function useChannelAgentsAndApps(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  const wsKey = workspaceId || 'default';
  const chKey = channelId || 'default';
  const agentsStorageKey = `onetab_ch_agents_${wsKey}_${chKey}`;
  const appsStorageKey = `onetab_ch_apps_${wsKey}_${chKey}`;
  const messagesStorageKey = `onetab_ch_agent_msgs_${wsKey}_${chKey}`;

  // 1. Agents state
  const [agents, setAgents] = useState<ChannelAIAgent[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(agentsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    // Default initial agents for this channel
    return PRESET_AI_AGENTS.slice(0, 3).map((a, i) => ({
      ...a,
      addedAt: Date.now() - (i + 1) * 86400000,
    }));
  });

  // 2. Apps state
  const [apps, setApps] = useState<ChannelConnectedApp[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(appsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    // Default initial apps for this channel
    return PRESET_CHANNEL_APPS.slice(0, 3).map((app, i) => ({
      ...app,
      addedAt: Date.now() - (i + 1) * 86400000,
    }));
  });

  // 3. Bot/Agent Messages stream for this channel
  const [messages, setMessages] = useState<ChannelBotMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(messagesStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createInitialMessages(chKey);
  });

  // Sync to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !channelId) return;
    try {
      localStorage.setItem(agentsStorageKey, JSON.stringify(agents));
    } catch {
      // ignore
    }
  }, [agents, agentsStorageKey, channelId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !channelId) return;
    try {
      localStorage.setItem(appsStorageKey, JSON.stringify(apps));
    } catch {
      // ignore
    }
  }, [apps, appsStorageKey, channelId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !channelId) return;
    try {
      localStorage.setItem(messagesStorageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, messagesStorageKey, channelId]);

  // Actions for Agents
  const addAgent = useCallback(
    (agent: Omit<ChannelAIAgent, 'addedAt'>) => {
      setAgents((prev) => {
        if (prev.some((a) => a.id === agent.id)) {
          toast.info(`${agent.name} is already added to this channel.`);
          return prev;
        }
        const newAgent: ChannelAIAgent = {
          ...agent,
          status: 'active',
          enabled: true,
          addedAt: Date.now(),
        };
        const updated = [newAgent, ...prev];
        toast.success(`Added ${agent.name} (${agent.handle}) to channel`);

        // Post an introductory message into the feed
        const introMsg: ChannelBotMessage = {
          id: `msg-agent-joined-${Date.now()}`,
          channelId: chKey,
          senderType: 'agent',
          senderId: agent.id,
          senderName: agent.name,
          senderHandle: agent.handle,
          senderAvatarSeed: agent.avatarSeed,
          badgeLabel: 'AI AGENT',
          badgeVariant: 'primary',
          model: agent.model,
          timestamp: Date.now(),
          content: `👋 Hello! I have been added to this channel as **${agent.role}**. Mention me with \`${agent.handle}\` or use slash commands (${agent.triggers.join(', ')}) whenever you need assistance!`,
          actions: [
            {
              id: 'act-intro-1',
              label: `Test ${agent.handle}`,
              variant: 'primary',
            },
          ],
        };
        setMessages((msgs) => [introMsg, ...msgs]);
        return updated;
      });
    },
    [chKey],
  );

  const removeAgent = useCallback((agentId: string) => {
    setAgents((prev) => {
      const target = prev.find((a) => a.id === agentId);
      const updated = prev.filter((a) => a.id !== agentId);
      toast.info(
        target ? `Removed ${target.name} from channel` : 'Agent removed',
      );
      return updated;
    });
  }, []);

  const toggleAgent = useCallback((agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== agentId) return a;
        const nextEnabled = !a.enabled;
        toast.success(
          `${a.name} is now ${nextEnabled ? 'Active' : 'Paused in this channel'}`,
        );
        return {
          ...a,
          enabled: nextEnabled,
          status: nextEnabled ? 'active' : 'paused',
        };
      }),
    );
  }, []);

  // Actions for Apps
  const addApp = useCallback(
    (app: Omit<ChannelConnectedApp, 'addedAt'>) => {
      setApps((prev) => {
        if (prev.some((a) => a.id === app.id)) {
          toast.info(`${app.name} is already connected to this channel.`);
          return prev;
        }
        const newApp: ChannelConnectedApp = {
          ...app,
          status: 'connected',
          enabled: true,
          addedAt: Date.now(),
        };
        const updated = [newApp, ...prev];
        toast.success(`Connected ${app.name} app to channel`);

        // Post an app connection notification
        const appJoinedMsg: ChannelBotMessage = {
          id: `msg-app-joined-${Date.now()}`,
          channelId: chKey,
          senderType: 'app',
          senderId: app.id,
          senderName: app.name,
          senderHandle: app.botHandle,
          senderAvatarSeed: app.icon,
          badgeLabel: 'APP',
          badgeVariant: 'violet',
          timestamp: Date.now(),
          content: `⚡ **${app.name} App** connected to channel. Listening to **${app.events.length} event types** (${app.events.join(', ')}).`,
          actions: [
            {
              id: 'act-app-config',
              label: 'Configure Webhooks',
              variant: 'outline',
            },
          ],
        };
        setMessages((msgs) => [appJoinedMsg, ...msgs]);
        return updated;
      });
    },
    [chKey],
  );

  const removeApp = useCallback((appId: string) => {
    setApps((prev) => {
      const target = prev.find((a) => a.id === appId);
      const updated = prev.filter((a) => a.id !== appId);
      toast.info(
        target ? `Disconnected ${target.name} from channel` : 'App removed',
      );
      return updated;
    });
  }, []);

  const toggleApp = useCallback((appId: string) => {
    setApps((prev) =>
      prev.map((a) => {
        if (a.id !== appId) return a;
        const nextEnabled = !a.enabled;
        toast.success(
          `${a.name} app is now ${nextEnabled ? 'Active' : 'Muted in this channel'}`,
        );
        return {
          ...a,
          enabled: nextEnabled,
          status: nextEnabled ? 'connected' : 'paused',
        };
      }),
    );
  }, []);

  // Send a test interactive message from an added agent or app
  const sendTestMessage = useCallback(
    (
      senderType: 'agent' | 'app',
      senderId: string,
      customPrompt?: string,
    ) => {
      const agent = agents.find((a) => a.id === senderId);
      const app = apps.find((a) => a.id === senderId);

      if (senderType === 'agent' && agent) {
        const prompt = customPrompt || 'Summarize recent sprint tasks';
        const newMsg: ChannelBotMessage = {
          id: `msg-custom-${Date.now()}`,
          channelId: chKey,
          senderType: 'agent',
          senderId: agent.id,
          senderName: agent.name,
          senderHandle: agent.handle,
          senderAvatarSeed: agent.avatarSeed,
          badgeLabel: 'AI AGENT',
          badgeVariant: 'primary',
          model: agent.model,
          timestamp: Date.now(),
          replyToHandle: '@you',
          content: `Here is the real-time execution result for **"${prompt}"**:

- **Status**: Completed with 0 warnings.
- **Context**: 3 active PRs, 5 open Linear tickets, and 0 critical blockers.
- **Action**: All automated CI checks passed. Next scheduled release is **v2.8.0** tomorrow morning.`,
          reasoning: {
            summary: `Executed prompt via ${agent.model}`,
            details: `Parsed prompt parameters, fetched channel telemetry, and generated structured response in 280ms.`,
            durationMs: 280,
          },
          toolsExecuted: [
            {
              name: `agent.execute("${prompt}")`,
              status: 'success',
              output: 'Processed successfully',
            },
          ],
          actions: [
            {
              id: 'act-ack',
              label: 'Pin Summary to Channel',
              variant: 'primary',
            },
            {
              id: 'act-share',
              label: 'Share with Team',
              variant: 'outline',
            },
          ],
          feedback: {
            helpful: true,
            reactionCount: 1,
          },
        };
        setMessages((prev) => [newMsg, ...prev]);
        toast.success(`Generated test message from ${agent.name}`);
      } else if (senderType === 'app' && app) {
        const newMsg: ChannelBotMessage = {
          id: `msg-app-test-${Date.now()}`,
          channelId: chKey,
          senderType: 'app',
          senderId: app.id,
          senderName: app.name,
          senderHandle: app.botHandle,
          senderAvatarSeed: app.icon,
          badgeLabel: 'APP EVENT',
          badgeVariant: 'violet',
          timestamp: Date.now(),
          content: `Simulated webhook event received from **${app.name}**:`,
          embedCard: {
            type: 'github_pr',
            title: `[${app.name.toUpperCase()}] Real-time synchronization event triggered`,
            accentColor: '#10b981',
            fields: [
              { label: 'Event', value: app.events[0] || 'custom.webhook', inline: true },
              { label: 'Delivered', value: 'Just now (Latency: 42ms)', inline: true },
              { label: 'Payload Status', value: '200 OK · Validated HMAC signature', inline: false },
            ],
            footer: `${app.name} Integration · Event #${Math.floor(Math.random() * 9000 + 1000)}`,
          },
          actions: [
            {
              id: 'act-view-log',
              label: 'View Raw Webhook Payload',
              variant: 'primary',
            },
          ],
        };
        setMessages((prev) => [newMsg, ...prev]);
        toast.success(`Triggered test event from ${app.name}`);
      }
    },
    [agents, apps, chKey],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    toast.info('Cleared bot messages feed');
  }, []);

  const resetToSample = useCallback(() => {
    const fresh = createInitialMessages(chKey);
    setMessages(fresh);
    toast.success('Reset messages to realistic demo feed');
  }, [chKey]);

  return {
    agents,
    apps,
    messages,
    addAgent,
    removeAgent,
    toggleAgent,
    addApp,
    removeApp,
    toggleApp,
    sendTestMessage,
    clearMessages,
    resetToSample,
    totalCount: agents.length + apps.length,
    activeAgentsCount: agents.filter((a) => a.enabled).length,
    activeAppsCount: apps.filter((a) => a.enabled).length,
  };
}
