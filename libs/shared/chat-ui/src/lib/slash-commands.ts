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
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  { name: '/here', description: 'Notify everyone active in this channel' },
  { name: '/channel', description: 'Notify everyone in this channel' },
  { name: '/huddle', description: 'Start a huddle in this channel' },
  {
    name: '/remind',
    args: '[who] [what] [when]',
    description: 'Set a reminder for yourself or someone else',
  },
  {
    name: '/topic',
    args: '[text]',
    description: "Set the channel's topic",
  },
  {
    name: '/invite',
    args: '@person',
    description: 'Add someone to this channel',
  },
  {
    name: '/dm',
    args: '@person [message]',
    description: 'Open a direct message',
  },
  { name: '/poll', args: '[question]', description: 'Start a quick poll' },
  { name: '/away', description: 'Toggle your away status' },
  { name: '/shrug', args: '[message]', description: 'Append ¯\\_(ツ)_/¯' },
];
