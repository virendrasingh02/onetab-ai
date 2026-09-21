import type { SlashCommand } from '@org/chat-ui';

/**
 * The `/` vocabulary for the raw AI chat surfaces (AI Studio home, docked
 * assistant), expressed as shared `SlashCommand`s with `expandsTo` set —
 * picking one drops its scaffold text at the caret instead of becoming a
 * `/name` chip, since these are prompt starting points, not backend actions.
 *
 * This is what previously lived in a bespoke suggestion system
 * (`ai-suggestions.ts`) alongside the now-retired `AIComposer`; the shared
 * `/`-menu (`SlashCommandsPlugin` in `@org/chat-ui`) offers the exact same
 * scaffolds through the same UI every other composer's `/` menu already uses.
 */
export const AI_STUDIO_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: '/summarize',
    description: 'Condense a thread, doc or transcript',
    expandsTo: 'Summarize the following, keeping the decisions and owners:\n\n',
  },
  {
    name: '/explain',
    description: 'Break something down in plain language',
    expandsTo: 'Explain the following in plain language:\n\n',
  },
  {
    name: '/plan',
    description: 'Turn a goal into ordered steps',
    expandsTo:
      'Break this goal into an ordered plan with owners and rough effort:\n\n',
  },
  {
    name: '/rewrite',
    description: 'Tighten wording without losing meaning',
    expandsTo: 'Rewrite the following to be clearer and shorter:\n\n',
  },
  {
    name: '/translate',
    description: 'Convert text to another language',
    expandsTo: 'Translate the following into English:\n\n',
  },
  {
    name: '/brainstorm',
    description: 'Generate options to react to',
    expandsTo: 'Brainstorm ten distinct ideas for: ',
  },
  {
    name: '/draft',
    description: 'Start a message or announcement',
    expandsTo: 'Draft a short, friendly message about: ',
  },
  {
    name: '/workflow',
    description: 'Execute automation workflow with payload',
    expandsTo: 'Execute workflow with input parameters:\n\n',
  },
  {
    name: '/knowledge',
    description: 'Search workspace knowledge base and cite sources',
    expandsTo: 'Search knowledge base and cite sources for:\n\n',
  },
  {
    name: '/agent',
    description: 'Dispatch task to autonomous agent',
    expandsTo: 'Delegate task to autonomous agent:\n\n',
  },
  {
    name: '/coworker',
    description: 'Ask AI coworker colleague for input',
    expandsTo: 'Collaborate with AI coworker on:\n\n',
  },
];
