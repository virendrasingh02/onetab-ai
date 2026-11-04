import { getAppLogoUrl, type AgentAppConnectionNeed } from '@org/types';
import { AiEntityAvatar, Button, type AiEntityKind } from '@org/ui';
import { cn } from '@org/utils';
import { CheckCircle2, Loader2, Plug, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { AppLogoAvatar } from '../app-logo-avatar.js';
import { EntityKindBadge } from '../entity-kind-badge.js';
import { PrivateNoticeRow } from '../private-notice-row.js';
import { useAiEntity } from './agent-avatar-context.js';
import { useAppConnector } from './app-connect-context.js';

/**
 * The apps an agent needs the viewer to connect, as Slack-style message
 * attachments: a slim accent bar, the app's logo and one action button each.
 * Rows read live state, so one turns into "connected" as soon as the
 * connection lands — on old messages too — and, once every app is in,
 * offers to ask the agent again.
 */
export function ConnectAppsBlock({
  needs,
  agentName,
  onAskAgain,
  className,
}: {
  needs: readonly AgentAppConnectionNeed[];
  agentName: string;
  onAskAgain?: () => void;
  className?: string;
}) {
  const connector = useAppConnector();
  const [busy, setBusy] = useState<string | null>(null);
  const states = needs.map((need) => ({
    need,
    connected: connector?.isConnected(need.provider) === true,
  }));
  const allConnected = states.length > 0 && states.every((s) => s.connected);

  const start = async (need: AgentAppConnectionNeed) => {
    if (!connector) return;
    setBusy(need.provider);
    try {
      await connector.connect(need.provider, need.label);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div aria-label="Apps to connect" role="group" className={cn('mt-2 max-w-xl space-y-1.5', className)}>
      {states.map(({ need, connected }) => {
        const reconnect = need.reason === 'reconnect';
        return (
          <div
            key={need.provider}
            className={cn(
              'flex items-center gap-3 rounded-r-lg border-l-[3px] bg-surface-raised/70 py-2 pl-3 pr-2',
              connected ? 'border-l-success' : reconnect ? 'border-l-warning' : 'border-l-primary',
            )}
          >
            <AppLogoAvatar logoUrl={getAppLogoUrl(need.provider, need.label)} size="sm" />
            <div className="min-w-0 flex-1 text-xs">
              {connected ? (
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                  {need.label} connected
                </p>
              ) : (
                <>
                  <p className="font-semibold text-foreground">
                    {reconnect ? `Reconnect ${need.label}` : `Connect ${need.label}`}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {reconnect
                      ? `Your ${need.label} sign-in expired, so ${agentName} can't use it right now.`
                      : `${agentName} works in ${need.label} through your own account.`}
                  </p>
                </>
              )}
            </div>
            {!connected && connector ? (
              <Button
                size="sm"
                variant={reconnect ? 'outline' : 'primary'}
                onClick={() => void start(need)}
                disabled={busy !== null}
                className="h-7 shrink-0 gap-1.5 text-xs"
              >
                {busy === need.provider ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : reconnect ? (
                  <RefreshCw className="size-3" aria-hidden />
                ) : (
                  <Plug className="size-3" aria-hidden />
                )}
                {reconnect ? 'Reconnect' : 'Connect'}
              </Button>
            ) : null}
          </div>
        );
      })}
      {allConnected && onAskAgain ? (
        <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
          <span>All set — {agentName} can use it now.</span>
          <Button size="sm" variant="outline" onClick={onAskAgain} className="h-7 gap-1.5 text-xs">
            <RefreshCw className="size-3" aria-hidden />
            Ask again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface AgentConnectNoticeProps {
  agentId: string;
  agentName: string;
  agentAvatarUrl?: string;
  needs: readonly AgentAppConnectionNeed[];
  /** When the notice was raised — placed in the timeline by it. */
  timestamp: number;
  onDismiss: () => void;
}

/**
 * The agent's own "Only visible to you" message in its conversation, raised
 * when it works in apps the viewer hasn't connected — like a Slack app
 * prompting you to sign in, it sits in the timeline as the agent's message
 * with the Connect buttons under it, instead of a bar over the chat.
 */
export function AgentConnectNotice({
  agentId,
  agentName,
  agentAvatarUrl,
  needs,
  timestamp,
  onDismiss,
}: AgentConnectNoticeProps) {
  const connector = useAppConnector();
  const live = useAiEntity(agentId, agentName);
  const name = live?.name || agentName;
  const kind: AiEntityKind = live?.kind ?? 'agent';
  const allConnected = needs.every((n) => connector?.isConnected(n.provider) === true);
  const apps = needs.map((n) => n.label);
  const appList = apps.length > 1 ? `${apps.slice(0, -1).join(', ')} and ${apps.at(-1)}` : apps[0];
  const reconnecting = needs.every((n) => n.reason === 'reconnect');

  return (
    <PrivateNoticeRow
      ariaLabel={`Only visible to you. ${name} needs ${appList} connected.`}
      avatar={<AiEntityAvatar name={name} kind={kind} avatarUrl={live?.avatarUrl || agentAvatarUrl} size="md" />}
      name={name}
      badge={<EntityKindBadge kind="agent" />}
      timestamp={timestamp}
      onDismiss={onDismiss}
      actions={
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          {allConnected ? 'Done' : 'Dismiss'}
        </Button>
      }
    >
      <p className="text-message leading-relaxed text-foreground">
        {allConnected
          ? `Thanks — ${appList} ${apps.length > 1 ? 'are' : 'is'} connected. Ask me anything.`
          : reconnecting
            ? `Your ${appList} connection expired. Reconnect it so I can keep working in your account.`
            : `To help you here I need access to your ${appList}. Connect your account — I only act on your behalf, and only with what you ask.`}
      </p>
      {allConnected ? null : <ConnectAppsBlock needs={needs} agentName={name} />}
    </PrivateNoticeRow>
  );
}
