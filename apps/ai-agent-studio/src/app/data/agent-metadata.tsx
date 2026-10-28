import { AiEntityAvatar, aiEntityAvatarFromLegacy, formatAiEntityIconAvatar } from '@org/ui';

export const DEFAULT_CATEGORIES = [
  'Customer Support',
  'Research & Extraction',
  'Sales & CRM',
  'Engineering & DevOps',
  'Finance & Operations',
  'HR & People',
  'Marketing & Content',
  'General',
];

/**
 * An agent's avatar in Studio — the shared `@org/ui` identity, so it matches
 * the same agent in the sidebar, chat and the coworker pages. Pass `avatarUrl`
 * for a draft being edited; otherwise it's read from the agent (including the
 * `configuration.icon` / `configuration.theme` older agents were saved with).
 */
export function AgentAvatar({
  agent,
  icon,
  avatarUrl,
  theme,
  size = 'md',
  className,
}: {
  agent?: any;
  /** @deprecated pass a full identity as `avatarUrl` (`icon:<icon>:<color>`). */
  icon?: string;
  avatarUrl?: string | null;
  /** @deprecated pass a full identity as `avatarUrl` (`icon:<icon>:<color>`). */
  theme?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const identity =
    avatarUrl ||
    (icon || theme ? formatAiEntityIconAvatar(icon ?? 'bot', theme) : null) ||
    aiEntityAvatarFromLegacy(agent?.avatarUrl, agent?.configuration);
  return <AiEntityAvatar name={agent?.name || 'Agent'} kind="agent" avatarUrl={identity} size={size} className={className} />;
}
