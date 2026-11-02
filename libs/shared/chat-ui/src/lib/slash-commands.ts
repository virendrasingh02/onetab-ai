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
  /**
   * Set for entries contributed by a configured app / agent / coworker rather
   * than built in. The menu renders them as "Title / App · Name · description"
   * rows and groups them under their source.
   */
  source?: SlashCommandSource;
  /** Section the `/` menu lists a built-in under. Unset → "Other". */
  category?: SlashCommandCategory;
  /**
   * Takes no input, so picking it from the menu runs it straight away instead
   * of leaving a chip for the user to send.
   */
  runOnSelect?: boolean;
  /** Row title (e.g. "Create an Issue"); falls back to `name`. */
  title?: string;
  /**
   * What picking the row inserts. Unset → a `/name` command chip.
   * `mention` → an `@` mention chip for the app/agent (so the message is
   * addressed to it), followed by `insertText`.
   */
  insert?: {
    mention?: { id: string; name: string; kind: 'agent' | 'coworker' | 'app' };
    /** Plain text dropped after the chip, e.g. `create_issue `. */
    text?: string;
  };
}

export type SlashCommandCategory =
  | 'conversation'
  | 'productivity'
  | 'navigation'
  | 'status';

/** Menu order and headings for built-in command categories. */
export const SLASH_COMMAND_CATEGORIES: { id: SlashCommandCategory; label: string }[] = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'navigation', label: 'Go to' },
  { id: 'status', label: 'You' },
];

export interface SlashCommandSource {
  kind: 'app' | 'agent' | 'coworker';
  /** Display name of the app/agent, e.g. "GitHub". */
  label: string;
  avatarUrl?: string;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: '/help',
    category: 'navigation',
    runOnSelect: true,
    description: 'Show available slash commands & shortcuts',
    icon: 'help',
  },
  {
    name: '/here',
    category: 'conversation',
    description: 'Notify everyone active in this channel',
    icon: 'users',
    allowedSurfaces: ['channel', 'group-dm', 'thread'],
  },
  {
    name: '/channel',
    category: 'conversation',
    description: 'Notify everyone in this channel',
    icon: 'megaphone',
    allowedSurfaces: ['channel', 'group-dm', 'thread'],
  },
  {
    name: '/huddle',
    category: 'conversation',
    runOnSelect: true,
    description: 'Start an audio/video huddle',
    icon: 'video',
    allowedSurfaces: ['channel', 'dm', 'group-dm'],
  },
  {
    name: '/remind',
    category: 'productivity',
    args: '[who] [what] [when]',
    description: 'Set a reminder for yourself or someone else',
    icon: 'clock',
  },
  {
    name: '/poll',
    category: 'conversation',
    args: '[question]',
    description: 'Create a poll everyone here can vote on',
    icon: 'bar-chart',
    allowedSurfaces: ['channel', 'dm', 'group-dm', 'thread'],
  },
  {
    name: '/topic',
    category: 'conversation',
    args: '[text]',
    description: "Set the channel's topic",
    icon: 'hash',
    allowedSurfaces: ['channel'],
    requiresManage: true,
  },
  {
    name: '/invite',
    category: 'conversation',
    args: '@person',
    description: 'Add someone to this channel',
    icon: 'user-plus',
    allowedSurfaces: ['channel', 'group-dm'],
    requiresManage: true,
  },
  {
    name: '/dm',
    category: 'navigation',
    args: '@person [message]',
    description: 'Open a direct message',
    icon: 'message-square',
  },
  {
    name: '/away',
    category: 'status',
    runOnSelect: true,
    description: 'Toggle your away status',
    icon: 'moon',
  },
  {
    name: '/shrug',
    category: 'status',
    args: '[message]',
    description: 'Append ¯\\_(ツ)_/¯',
    icon: 'smile',
  },
  {
    name: '/search',
    category: 'navigation',
    args: '[query]',
    description: 'Search messages, files and channels',
    icon: 'search',
  },
  {
    name: '/settings',
    category: 'navigation',
    runOnSelect: true,
    description: 'Open your preferences and settings',
    icon: 'settings',
  },
  {
    name: '/task',
    category: 'productivity',
    args: '[title]',
    description: 'Create a new task in this workspace',
    icon: 'check-square',
    allowedSurfaces: ['channel', 'dm', 'group-dm', 'thread'],
  },
  {
    name: '/assign',
    category: 'productivity',
    args: '@person [task]',
    description: 'Assign a task to someone',
    icon: 'user-check',
    allowedSurfaces: ['channel', 'dm', 'group-dm', 'thread'],
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
