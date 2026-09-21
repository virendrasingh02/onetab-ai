import type { ComposerSurfaceKind } from '@org/types';

/**
 * Slash commands the composer offers.
 *
 * They live in their own module because both the composer shell and the editor
 * inside it need the type, and importing it from the shell would close a cycle.
 */
export interface SlashCommand {
  /** Including the leading slash, e.g. `/remind`. */
  name: string;
  args?: string;
  description: string;
  icon?: string;
  /** Surfaces where this command is available. Unset means available on all surfaces. */
  allowedSurfaces?: ComposerSurfaceKind[];
  /** Whether this command requires channel/workspace management permissions. */
  requiresManage?: boolean;
  /**
   * Prompt-scaffold commands (AI Studio's `/summarize`, `/explain`, …) expand to
   * this text at the caret instead of becoming a `/name` chip — picking one is
   * "start typing from here", not "tag this message with a command".
   */
  expandsTo?: string;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: '/help',
    description: 'Show available slash commands & shortcuts',
    icon: 'help',
  },
  {
    name: '/here',
    description: 'Notify everyone active in this channel',
    icon: 'users',
    allowedSurfaces: ['channel', 'group-dm', 'thread'],
  },
  {
    name: '/channel',
    description: 'Notify everyone in this channel',
    icon: 'megaphone',
    allowedSurfaces: ['channel', 'group-dm', 'thread'],
  },
  {
    name: '/huddle',
    description: 'Start an audio/video huddle',
    icon: 'video',
    allowedSurfaces: ['channel', 'dm', 'group-dm'],
  },
  {
    name: '/remind',
    args: '[who] [what] [when]',
    description: 'Set a reminder for yourself or someone else',
    icon: 'clock',
  },
  {
    name: '/topic',
    args: '[text]',
    description: "Set the channel's topic",
    icon: 'hash',
    allowedSurfaces: ['channel'],
    requiresManage: true,
  },
  {
    name: '/invite',
    args: '@person',
    description: 'Add someone to this channel',
    icon: 'user-plus',
    allowedSurfaces: ['channel', 'group-dm'],
    requiresManage: true,
  },
  {
    name: '/dm',
    args: '@person [message]',
    description: 'Open a direct message',
    icon: 'message-square',
  },
  {
    name: '/poll',
    args: '[question]',
    description: 'Start a quick poll in this conversation',
    icon: 'bar-chart',
    allowedSurfaces: ['channel', 'group-dm'],
  },
  {
    name: '/away',
    description: 'Toggle your away status',
    icon: 'moon',
  },
  {
    name: '/shrug',
    args: '[message]',
    description: 'Append ¯\\_(ツ)_/¯',
    icon: 'smile',
  },
  {
    name: '/search',
    args: '[query]',
    description: 'Search messages, files and channels',
    icon: 'search',
  },
  {
    name: '/settings',
    description: 'Open your preferences and settings',
    icon: 'settings',
  },
  {
    name: '/task',
    args: '[title]',
    description: 'Create a new task in this workspace',
    icon: 'check-square',
    allowedSurfaces: ['channel', 'dm', 'group-dm', 'thread'],
  },
  {
    name: '/assign',
    args: '@person [task]',
    description: 'Assign a task to someone',
    icon: 'user-check',
    allowedSurfaces: ['channel', 'dm', 'group-dm', 'thread'],
  },
  {
    name: '/github',
    args: '<issue | pr | repo>',
    description: 'Query GitHub pull requests or issues',
    icon: 'git-pull-request',
  },
  {
    name: '/linear',
    args: '<issue-id | create>',
    description: 'Lookup or create Linear issues',
    icon: 'check-square',
  },
  {
    name: '/jira',
    args: '<issue-key>',
    description: 'Lookup Jira tickets and status',
    icon: 'file-text',
  },
  {
    name: '/agent',
    args: '<review | triage | query>',
    description: 'Invoke an autonomous AI agent',
    icon: 'bot',
    allowedSurfaces: ['channel', 'agent', 'thread'],
  },
];

/**
 * Filter slash commands based on the active conversation surface and viewer permissions.
 */
export function getContextualSlashCommands(options: {
  commands?: SlashCommand[];
  surfaceKind?: ComposerSurfaceKind;
  viewerCanManage?: boolean;
  isGuest?: boolean;
}): SlashCommand[] {
  const {
    commands = DEFAULT_SLASH_COMMANDS,
    surfaceKind = 'channel',
    viewerCanManage = false,
    isGuest = false,
  } = options;

  return commands.filter((cmd) => {
    // 1. Surface check
    if (cmd.allowedSurfaces && !cmd.allowedSurfaces.includes(surfaceKind)) {
      return false;
    }

    // 2. Manage permission check
    if (cmd.requiresManage && !viewerCanManage) {
      return false;
    }

    // 3. Guest restrictions (@here, @channel, workspace actions)
    if (isGuest && (cmd.name === '/here' || cmd.name === '/channel')) {
      return false;
    }

    return true;
  });
}
