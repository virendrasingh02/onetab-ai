import { aiApi } from '@org/api-client';
import { useMutation } from '@tanstack/react-query';

export type CardAiTask = 'description' | 'checklist' | 'subIssues' | 'summary';

export interface CardAiContext {
  title: string;
  status: string;
  description: string;
  /** "Name: text" lines, oldest first. */
  comments: string[];
}

const LIST_FORMAT =
  'Reply with one item per line and nothing else: no heading, no numbering, no commentary. Each item is a short imperative phrase.';

function promptFor(task: CardAiTask, context: CardAiContext): string {
  const about = [
    `Task title: ${context.title}`,
    `Status: ${context.status}`,
    context.description ? `Description:\n${context.description}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  switch (task) {
    case 'description':
      return `${about}\n\nWrite a concise task description: a one- or two-sentence overview, then a short markdown list of acceptance criteria.`;
    case 'checklist':
      return `${about}\n\nList the 3 to 6 small action items needed to finish this task. ${LIST_FORMAT}`;
    case 'subIssues':
      return `${about}\n\nBreak this task into 2 to 6 separate sub-tasks that could each be assigned to a person. ${LIST_FORMAT}`;
    case 'summary':
      return `${about}\n\nDiscussion so far:\n${context.comments.join('\n')}\n\nSummarize this discussion in two or three sentences: what was decided and what is still open.`;
  }
}

/** Reads a model's list reply, tolerating the bullets and numbers it adds anyway. */
export function parseAiList(text: string): string[] {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*+•]|\d+[.)])?\s*(?:\[[ xX]\]\s*)?/, '')
        .replace(/^\*\*(.*)\*\*$/, '$1')
        .trim(),
    )
    .filter((line) => line.length > 0 && !line.endsWith(':'))
    .slice(0, 8);
}

export function useCardAi(
  workspaceId: string | undefined,
  context: CardAiContext,
) {
  return useMutation({
    mutationFn: async (task: CardAiTask) => {
      if (!workspaceId) throw new Error('Workspace context required');
      const response = await aiApi.chat(workspaceId, {
        messages: [{ role: 'user', content: promptFor(task, context) }],
      });
      return response.message.content;
    },
    meta: {
      errorMessage: 'Brain² could not finish that. Try again in a moment.',
    },
  });
}
