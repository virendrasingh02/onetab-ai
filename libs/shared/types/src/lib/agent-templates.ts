/**
 * Starter agents for the AI Agent Studio.
 *
 * Each template is a complete blueprint made only of tools the platform
 * really has, so creating one gives a working agent — not a sketch. They are
 * also the planner's fallback: when no model is configured, the Studio starts
 * from the template closest to what the person asked for, and says so.
 */

import type { AgentBlueprint, AgentBlueprintStep } from './agent-blueprint.js';

export type AgentTemplateCategory = 'daily' | 'projects' | 'communication' | 'research' | 'monitoring';

export const AGENT_TEMPLATE_CATEGORIES: Record<AgentTemplateCategory, string> = {
  daily: 'Daily work',
  projects: 'Projects',
  communication: 'Communication',
  research: 'Research & writing',
  monitoring: 'Monitoring',
};

export interface AgentTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: AgentTemplateCategory;
  /** A lucide icon name; the Studio maps it to a component. */
  icon: string;
  /** Words that point a request at this template when AI planning is unavailable. */
  keywords: string[];
  /** Connected apps it needs (lower-case provider keys). */
  requires?: string[];
  blueprint: () => AgentBlueprint;
}

const NOTIFY_DEFAULT = { onComplete: false, onFailure: true, onApproval: true };

function bp(partial: Omit<AgentBlueprint, 'version' | 'questions' | 'assumptions' | 'warnings' | 'source' | 'notify' | 'params' | 'context'> &
  Partial<Pick<AgentBlueprint, 'notify' | 'params' | 'context' | 'assumptions'>>,
  templateId: string,
): AgentBlueprint {
  return {
    version: 1,
    questions: [],
    warnings: [],
    params: [],
    context: [],
    assumptions: [],
    notify: NOTIFY_DEFAULT,
    ...partial,
    source: { kind: 'template', templateId },
  };
}

const step = (s: AgentBlueprintStep) => s;

export const AGENT_TEMPLATES: AgentTemplateDefinition[] = [
  {
    id: 'daily-todo',
    name: 'Daily to-do plan',
    description: 'Every weekday morning, turns your tasks, deadlines and meetings into a prioritised plan with a reason for each item.',
    category: 'daily',
    icon: 'ListTodo',
    keywords: ['todo', 'to-do', 'to do', 'plan my day', 'priorit', 'morning', 'daily plan', 'today', 'task list'],
    blueprint: () =>
      bp(
        {
          name: 'Daily to-do plan',
          kind: 'personal',
          objective: 'Start each weekday with a prioritised plan built from your real tasks, deadlines and meetings.',
          trigger: { kind: 'schedule', cron: '0 8 * * 1-5' },
          context: ['Your open and overdue tasks', 'Today’s meetings', 'Project deadlines and health'],
          steps: [
            step({ id: 'open_tasks', kind: 'collect', title: 'Get your open tasks', why: 'Everything still on your plate', tool: 'find_tasks', input: { assignee: 'me', status: 'open', limit: 50 } }),
            step({ id: 'overdue', kind: 'collect', title: 'Find overdue tasks', why: 'Overdue work usually comes first', tool: 'find_tasks', input: { assignee: 'me', overdue: true } }),
            step({ id: 'meetings', kind: 'collect', title: 'Check today’s meetings', why: 'Meetings take time and may need preparation', tool: 'list_meetings', input: { range: 'today', includeNotes: false } }),
            step({ id: 'projects', kind: 'collect', title: 'Check project priorities', why: 'Deadlines and at-risk projects change what matters', tool: 'get_project_overview', input: {} }),
            step({
              id: 'plan',
              kind: 'generate',
              title: 'Prioritise today’s work',
              why: 'Turns the list into an order you can follow',
              prompt:
                'Write my plan for today in Markdown. Group the work under **High**, **Medium** and **Low** priority. For every item give one short reason it sits there (overdue, due soon, blocks others, meeting prep, project at risk). Add a **Schedule** list of today’s meetings with times. End with **Start with:** and the single best first task.',
            }),
            step({ id: 'notify', kind: 'notify', title: 'Send you the plan', why: 'So it is waiting for you when you start', tool: 'notify_user', input: { title: 'Your plan for {{now.weekday}}', body: '{{plan.aiOutput}}' } }),
          ],
          output: { format: 'todo_list', destination: 'notification', fromStep: 'plan' },
          scopes: ['tasks:read', 'meetings:read', 'projects:read', 'notify:send'],
          assumptions: ['Runs at 8:00 AM on weekdays in your time zone.'],
        },
        'daily-todo',
      ),
  },
  {
    id: 'daily-report',
    name: 'Daily work report',
    description: 'Every weekday evening, drafts your report from completed tasks, activity and meeting notes, asks you to approve it, then saves it as a doc.',
    category: 'daily',
    icon: 'FileText',
    keywords: ['daily report', 'work report', 'end of day', 'eod', 'evening', 'what i completed', 'what i did', 'status report', 'report'],
    blueprint: () =>
      bp(
        {
          name: 'Daily work report',
          kind: 'personal',
          objective: 'Prepare an accurate daily work report from what actually happened today, for you to approve before it is saved.',
          trigger: { kind: 'schedule', cron: '0 18 * * 1-5' },
          context: ['Tasks you completed and worked on today', 'Today’s project activity', 'Today’s meeting notes and decisions'],
          steps: [
            step({ id: 'completed', kind: 'collect', title: 'Get tasks you completed today', why: 'The core of what you delivered', tool: 'find_tasks', input: { assignee: 'me', status: 'done', completedSince: 'today' } }),
            step({ id: 'in_progress', kind: 'collect', title: 'Get tasks you worked on', why: 'Work that moved but is not finished', tool: 'find_tasks', input: { assignee: 'me', status: 'open', updatedSince: 'today' } }),
            step({ id: 'activity', kind: 'collect', title: 'Read today’s project activity', why: 'Changes the task list alone does not show', tool: 'get_activity', input: { range: 'today', mine: true } }),
            step({ id: 'meetings', kind: 'collect', title: 'Read today’s meeting notes', why: 'Decisions and action items from meetings', tool: 'list_meetings', input: { range: 'today', includeNotes: true } }),
            step({
              id: 'blockers',
              kind: 'analyze',
              title: 'Detect blockers',
              why: 'A report should say what is stuck and why',
              prompt:
                'List anything blocked or at risk: tasks marked blocked or waiting on others, overdue items, open decisions. For each say what it is waiting on. If nothing is blocked, reply exactly “No blockers found.”',
            }),
            step({
              id: 'report',
              kind: 'generate',
              title: 'Write the report',
              why: 'Puts it together in a format you can share',
              prompt:
                'Write my daily work report in Markdown with these sections: **Summary** (2–3 sentences), **Completed**, **In progress**, **Blocked**, **Next steps**, **Important decisions** (from meeting decisions) and **Time tracked** (sum the time spent where tasks record it; otherwise say it was not tracked). Keep it factual and short.',
              uses: ['completed', 'in_progress', 'activity', 'meetings', 'blockers'],
            }),
            step({ id: 'review', kind: 'approval', title: 'Review the report', why: 'You approve or edit it before it is saved' }),
            step({ id: 'publish', kind: 'action', title: 'Save the report as a doc', why: 'Keeps a history you and your team can find', tool: 'create_doc', input: { title: 'Daily report — {{now.date}}', content: '{{report.aiOutput}}' } }),
          ],
          output: { format: 'report', destination: 'doc', fromStep: 'report', docTitle: 'Daily report — {{now.date}}' },
          scopes: ['tasks:read', 'activity:read', 'meetings:read', 'docs:write'],
          notify: { onComplete: true, onFailure: true, onApproval: true },
          assumptions: ['Runs at 6:00 PM on weekdays in your time zone.', 'Waits for your approval before saving anything.'],
        },
        'daily-report',
      ),
  },
  {
    id: 'meeting-summary',
    name: 'Meeting summary',
    description: 'When a meeting ends, summarises its notes, decisions and action items into a doc and tells you it is ready.',
    category: 'communication',
    icon: 'NotebookPen',
    keywords: ['meeting summary', 'meeting notes', 'after meeting', 'meeting ends', 'minutes', 'recap'],
    blueprint: () =>
      bp(
        {
          name: 'Meeting summary',
          kind: 'automation',
          objective: 'Turn every finished meeting into a clear summary with decisions and owners.',
          trigger: { kind: 'event', event: 'meeting.ended' },
          context: ['The meeting’s agenda, notes, decisions and action items'],
          steps: [
            step({ id: 'meeting', kind: 'collect', title: 'Read the meeting', why: 'Its agenda, notes, decisions and action items', tool: 'list_meetings', input: { meetingId: '{{event.meetingId}}', includeNotes: true } }),
            step({
              id: 'summary',
              kind: 'generate',
              title: 'Summarise it',
              why: 'People who missed it can catch up in a minute',
              prompt:
                'Summarise this meeting in Markdown: **Summary** (3 sentences), **Decisions**, **Action items** (owner and due date where recorded), **Open questions**. Only use what the notes say; if there are no notes, say the meeting had no notes.',
            }),
            step({ id: 'save', kind: 'action', title: 'Save the summary as a doc', tool: 'create_doc', input: { title: 'Meeting summary — {{event.title}}', content: '{{summary.aiOutput}}' } }),
            step({ id: 'notify', kind: 'notify', title: 'Tell you it is ready', tool: 'notify_user', input: { title: 'Summary ready: {{event.title}}', body: '{{summary.aiOutput}}' } }),
          ],
          output: { format: 'summary', destination: 'doc', fromStep: 'summary' },
          scopes: ['meetings:read', 'docs:write', 'notify:send'],
        },
        'meeting-summary',
      ),
  },
  {
    id: 'project-health',
    name: 'Project health & blockers',
    description: 'Reviews a project’s tasks, dependencies and activity, explains what is blocked or late and why, and suggests next actions — with sources.',
    category: 'projects',
    icon: 'Activity',
    keywords: ['blocked', 'blocker', 'project health', 'delayed', 'delay', 'why is', 'review my project', 'project status', 'risk', 'at risk', 'progress'],
    blueprint: () =>
      bp(
        {
          name: 'Project health & blockers',
          kind: 'project',
          objective: 'Explain where a project stands, what is blocked or late and why, and what to do next.',
          trigger: { kind: 'manual' },
          context: ['The project’s tasks, dependencies and deadlines', 'The last week of activity'],
          params: [{ key: 'projectId', label: 'Project', type: 'project', hint: 'Leave empty to review every active project.' }],
          steps: [
            step({ id: 'overview', kind: 'collect', title: 'Read the project', why: 'Status, deadlines, blocked and overdue tasks', tool: 'get_project_overview', input: { projectId: '{{params.projectId}}' } }),
            step({ id: 'activity', kind: 'collect', title: 'Read the last week of activity', why: 'Shows what moved and what stalled', tool: 'get_activity', input: { range: 'last_7_days', projectId: '{{params.projectId}}', mine: false } }),
            step({
              id: 'analysis',
              kind: 'analyze',
              title: 'Find blockers and risks',
              why: 'Separates causes from symptoms',
              prompt:
                'Work out: the current status; which tasks are blocked and by what (use the dependency data); what is overdue; which people or areas are affected; and the risk to the target date.',
            }),
            step({
              id: 'report',
              kind: 'generate',
              title: 'Write the health report',
              why: 'A short answer you can act on',
              prompt:
                'Write a project health report in Markdown with: **Current status**, **Blocked** (each item with what blocks it), **Delay causes**, **Dependencies**, **Responsible areas**, **Suggested next actions** (concrete, with an owner when known) and **Sources** (the task identifiers or titles you used).',
            }),
          ],
          output: { format: 'answer', destination: 'run', fromStep: 'report' },
          scopes: ['projects:read', 'activity:read'],
        },
        'project-health',
      ),
  },
  {
    id: 'email-follow-up',
    name: 'Email follow-ups',
    description: 'Each weekday morning, reads new Gmail, finds emails that need a reply or action and — after you approve — creates follow-up tasks.',
    category: 'communication',
    icon: 'MailCheck',
    keywords: ['email', 'gmail', 'inbox', 'mail', 'follow-up', 'follow up', 'reply'],
    requires: ['gmail'],
    blueprint: () =>
      bp(
        {
          name: 'Email follow-ups',
          kind: 'automation',
          objective: 'Make sure no email that needs a reply or action slips through.',
          trigger: { kind: 'schedule', cron: '0 9 * * 1-5' },
          context: ['Unread Gmail from the last day'],
          steps: [
            step({ id: 'inbox', kind: 'collect', title: 'Read new email', why: 'Unread mail from the last day', tool: 'search_email', input: { query: 'is:unread newer_than:1d -category:promotions -category:social', maxResults: 20 }, retries: 2, onFailure: 'continue' }),
            step({
              id: 'triage',
              kind: 'analyze',
              title: 'Find emails that need follow-up',
              why: 'Only requests, questions and deadlines — not newsletters',
              prompt:
                'List the emails that need a reply or an action from me: sender, subject, what is asked and any due date. If the email step failed, say exactly why (for example that Gmail is not connected) and stop.',
            }),
            step({
              id: 'followups',
              kind: 'generate',
              title: 'Turn them into tasks',
              prompt:
                'Return ONLY a JSON array of follow-up tasks, one per email that needs action: [{"title": "...", "description": "who asked, what, and the email subject", "dueDate": "YYYY-MM-DD or null", "priority": "HIGH|MEDIUM|LOW"}]. Return [] when there are none.',
              uses: ['triage'],
            }),
            step({ id: 'has_followups', kind: 'condition', title: 'Anything to follow up?', condition: 'followups.aiOutput contains "title"' }),
            step({ id: 'create', kind: 'action', title: 'Create follow-up tasks', why: 'So each one has an owner and a date', tool: 'create_tasks', input: { tasks: '{{followups.aiOutput}}', assignToMe: true }, requiresApproval: true }),
          ],
          output: { format: 'tasks', destination: 'run', fromStep: 'triage' },
          scopes: ['app:gmail:read', 'tasks:write'],
          notify: { onComplete: true, onFailure: true, onApproval: true },
          assumptions: ['Runs at 9:00 AM on weekdays in your time zone.', 'Needs Gmail connected in Integrations.'],
        },
        'email-follow-up',
      ),
  },
  {
    id: 'research-assistant',
    name: 'Research assistant',
    description: 'Ask a question; it searches the web and your workspace docs and writes a short, sourced brief.',
    category: 'research',
    icon: 'Search',
    keywords: ['research', 'find out', 'investigate', 'look up', 'search the web', 'compare', 'market'],
    blueprint: () =>
      bp(
        {
          name: 'Research assistant',
          kind: 'research',
          objective: 'Answer a research question with a short brief that cites its sources.',
          trigger: { kind: 'manual' },
          context: ['Public web results', 'Your workspace docs'],
          steps: [
            step({ id: 'web', kind: 'collect', title: 'Search the web', tool: 'firecrawl_search', input: { query: '{{input.text}}', limit: 5 }, onFailure: 'continue' }),
            step({ id: 'docs', kind: 'collect', title: 'Search workspace docs', tool: 'search_docs', input: { query: '{{input.text}}' } }),
            step({
              id: 'brief',
              kind: 'generate',
              title: 'Write the brief',
              prompt:
                'Answer the request as a brief: **Answer** (3–5 bullets), **Details**, **Sources** (URL or doc title for every claim). If the web search failed, say so and answer from the docs alone.',
            }),
          ],
          output: { format: 'answer', destination: 'run', fromStep: 'brief' },
          scopes: ['web:read', 'docs:read'],
        },
        'research-assistant',
      ),
  },
  {
    id: 'customer-follow-up',
    name: 'Customer reply draft',
    description: 'Paste a customer’s message; it drafts a reply from your docs and policies for you to approve, then saves the draft.',
    category: 'communication',
    icon: 'MessageSquareReply',
    keywords: ['customer', 'client', 'draft a response', 'draft response', 'reply to', 'support', 'respond'],
    blueprint: () =>
      bp(
        {
          name: 'Customer reply draft',
          kind: 'task',
          objective: 'Draft an accurate, friendly reply to a customer, grounded in your own docs.',
          trigger: { kind: 'manual' },
          context: ['The customer’s message', 'Relevant workspace docs'],
          steps: [
            step({ id: 'context', kind: 'collect', title: 'Find relevant docs', why: 'Policies and facts the reply can rely on', tool: 'search_docs', input: { query: '{{input.text}}' } }),
            step({
              id: 'draft',
              kind: 'generate',
              title: 'Draft the reply',
              prompt:
                'Draft a reply to the customer message in the request. Be warm and concise. Only state facts the docs support; where you would need something you do not have, write a placeholder in [square brackets].',
            }),
            step({ id: 'review', kind: 'approval', title: 'Review the draft', why: 'Nothing is saved until you approve' }),
            step({ id: 'save', kind: 'action', title: 'Save the draft as a doc', tool: 'create_doc', input: { title: 'Customer reply — {{now.date}}', content: '{{draft.aiOutput}}' } }),
          ],
          output: { format: 'draft', destination: 'doc', fromStep: 'draft' },
          scopes: ['docs:read', 'docs:write'],
        },
        'customer-follow-up',
      ),
  },
  {
    id: 'weekly-report',
    name: 'Weekly report',
    description: 'Every Friday afternoon, drafts your weekly report from tasks, activity, meetings and project health, then saves it after you approve.',
    category: 'daily',
    icon: 'CalendarRange',
    keywords: ['weekly', 'week', 'friday', 'weekly report', 'weekly summary', 'management summary'],
    blueprint: () =>
      bp(
        {
          name: 'Weekly report',
          kind: 'personal',
          objective: 'Summarise the week — delivered, in progress, risks and next week — for you to approve and share.',
          trigger: { kind: 'schedule', cron: '0 16 * * 5' },
          context: ['Tasks completed this week', 'This week’s activity and meetings', 'Project health'],
          steps: [
            step({ id: 'completed', kind: 'collect', title: 'Get tasks completed this week', tool: 'find_tasks', input: { assignee: 'me', status: 'done', completedSince: 'this_week' } }),
            step({ id: 'activity', kind: 'collect', title: 'Read this week’s activity', tool: 'get_activity', input: { range: 'this_week', mine: true } }),
            step({ id: 'meetings', kind: 'collect', title: 'Read this week’s meetings', tool: 'list_meetings', input: { range: 'this_week', includeNotes: true } }),
            step({ id: 'projects', kind: 'collect', title: 'Check project health', tool: 'get_project_overview', input: {} }),
            step({
              id: 'report',
              kind: 'generate',
              title: 'Write the weekly report',
              prompt:
                'Write my weekly report in Markdown: **Highlights**, **Completed**, **In progress**, **Risks & blockers**, **Decisions**, **Next week**. Be specific and brief.',
            }),
            step({ id: 'review', kind: 'approval', title: 'Review the report' }),
            step({ id: 'publish', kind: 'action', title: 'Save the report as a doc', tool: 'create_doc', input: { title: 'Weekly report — {{now.date}}', content: '{{report.aiOutput}}' } }),
          ],
          output: { format: 'report', destination: 'doc', fromStep: 'report' },
          scopes: ['tasks:read', 'activity:read', 'meetings:read', 'projects:read', 'docs:write'],
          notify: { onComplete: true, onFailure: true, onApproval: true },
          assumptions: ['Runs at 4:00 PM on Fridays in your time zone.'],
        },
        'weekly-report',
      ),
  },
  {
    id: 'content-assistant',
    name: 'Content assistant',
    description: 'Give it a topic; it researches, drafts a post or announcement in your voice, and saves it after you approve.',
    category: 'research',
    icon: 'PenLine',
    keywords: ['write', 'blog', 'post', 'announcement', 'article', 'content', 'newsletter', 'draft'],
    blueprint: () =>
      bp(
        {
          name: 'Content assistant',
          kind: 'task',
          objective: 'Draft a well-researched piece on a topic for you to approve.',
          trigger: { kind: 'manual' },
          context: ['Web results on the topic', 'Your workspace docs'],
          instructions: 'Write in a clear, friendly, professional voice. Prefer short paragraphs.',
          steps: [
            step({ id: 'web', kind: 'collect', title: 'Research the topic', tool: 'firecrawl_search', input: { query: '{{input.text}}', limit: 5 }, onFailure: 'continue' }),
            step({ id: 'docs', kind: 'collect', title: 'Find related docs', tool: 'search_docs', input: { query: '{{input.text}}' } }),
            step({ id: 'draft', kind: 'generate', title: 'Draft the piece', prompt: 'Write the piece the request asks for, with a title, a short intro, the body and a closing line. List sources at the end.' }),
            step({ id: 'review', kind: 'approval', title: 'Review the draft' }),
            step({ id: 'save', kind: 'action', title: 'Save it as a doc', tool: 'create_doc', input: { title: 'Draft — {{now.date}}', content: '{{draft.aiOutput}}' } }),
          ],
          output: { format: 'draft', destination: 'doc', fromStep: 'draft' },
          scopes: ['web:read', 'docs:read', 'docs:write'],
        },
        'content-assistant',
      ),
  },
  {
    id: 'project-planner',
    name: 'Project planner',
    description: 'Reads a requirements doc, drafts a project plan with milestones and tasks, and creates the tasks after you approve.',
    category: 'projects',
    icon: 'Map',
    keywords: ['project plan', 'plan from', 'requirement', 'break down', 'milestones', 'create a plan', 'roadmap', 'executable'],
    blueprint: () =>
      bp(
        {
          name: 'Project planner',
          kind: 'project',
          objective: 'Turn a requirements doc into a project plan and the tasks to carry it out.',
          trigger: { kind: 'manual' },
          context: ['The requirements doc', 'Existing projects'],
          params: [
            { key: 'docId', label: 'Requirements doc', type: 'doc', required: true },
            { key: 'projectId', label: 'Project to add tasks to', type: 'project', hint: 'Optional — tasks are created without a project otherwise.' },
          ],
          steps: [
            step({ id: 'doc', kind: 'collect', title: 'Read the requirements doc', tool: 'read_doc', input: { docId: '{{params.docId}}' } }),
            step({
              id: 'plan',
              kind: 'analyze',
              title: 'Draft the project plan',
              prompt: 'Draft a project plan in Markdown: **Goal**, **Scope**, **Milestones** (with rough dates), **Tasks** per milestone, **Risks** and **Open questions**. Base it only on the doc.',
            }),
            step({
              id: 'tasks_json',
              kind: 'generate',
              title: 'List the tasks',
              prompt: 'Return ONLY a JSON array of the tasks in the plan: [{"title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "dueDate": "YYYY-MM-DD or null"}]. At most 15 tasks.',
              uses: ['plan'],
            }),
            step({ id: 'create', kind: 'action', title: 'Create the tasks', tool: 'create_tasks', input: { tasks: '{{tasks_json.aiOutput}}', projectId: '{{params.projectId}}' }, requiresApproval: true }),
          ],
          output: { format: 'report', destination: 'run', fromStep: 'plan' },
          scopes: ['docs:read', 'tasks:write'],
        },
        'project-planner',
      ),
  },
  {
    id: 'task-monitor',
    name: 'Overdue task watch',
    description: 'When one of your tasks becomes overdue, suggests a realistic next step and notifies you.',
    category: 'monitoring',
    icon: 'AlarmClock',
    keywords: ['overdue', 'monitor', 'watch', 'alert me', 'deadline', 'late', 'when something needs attention'],
    blueprint: () =>
      bp(
        {
          name: 'Overdue task watch',
          kind: 'monitoring',
          objective: 'Catch overdue work as soon as it slips and suggest what to do.',
          trigger: { kind: 'event', event: 'task.overdue' },
          context: ['The overdue task'],
          steps: [
            step({ id: 'task', kind: 'collect', title: 'Read the task', tool: 'find_tasks', input: { taskId: '{{event.taskId}}', assignee: 'anyone', status: 'all' } }),
            step({
              id: 'suggest',
              kind: 'generate',
              title: 'Suggest a next step',
              prompt: 'This task just became overdue. In two sentences: say what is overdue and by how much, then suggest one realistic next step (finish, re-plan the date, or hand off).',
            }),
            step({ id: 'notify', kind: 'notify', title: 'Notify you', tool: 'notify_user', input: { title: 'Overdue: {{event.title}}', body: '{{suggest.aiOutput}}' } }),
          ],
          output: { format: 'alert', destination: 'notification', fromStep: 'suggest' },
          scopes: ['tasks:read', 'notify:send'],
        },
        'task-monitor',
      ),
  },
  {
    id: 'meeting-prep',
    name: 'Meeting prep',
    description: 'Each weekday morning, prepares a short brief for each of today’s meetings: context, open items and questions to raise.',
    category: 'daily',
    icon: 'CalendarCheck',
    keywords: ['meeting prep', 'prepare for', 'before meeting', 'agenda', 'brief me'],
    blueprint: () =>
      bp(
        {
          name: 'Meeting prep',
          kind: 'personal',
          objective: 'Walk into every meeting knowing the context and what to ask.',
          trigger: { kind: 'schedule', cron: '30 8 * * 1-5' },
          context: ['Today’s meetings and agendas', 'Your open tasks'],
          steps: [
            step({ id: 'meetings', kind: 'collect', title: 'Get today’s meetings', tool: 'list_meetings', input: { range: 'today', includeNotes: true } }),
            step({ id: 'tasks', kind: 'collect', title: 'Get your open tasks', tool: 'find_tasks', input: { assignee: 'me', status: 'open', limit: 40 } }),
            step({
              id: 'brief',
              kind: 'generate',
              title: 'Write the prep brief',
              prompt: 'For each meeting today write: time and title, what it is about (agenda), related open tasks, and 2–3 questions to raise. If there are no meetings today, say so in one line.',
            }),
            step({ id: 'notify', kind: 'notify', title: 'Send you the brief', tool: 'notify_user', input: { title: 'Meeting prep for {{now.weekday}}', body: '{{brief.aiOutput}}' } }),
          ],
          output: { format: 'summary', destination: 'notification', fromStep: 'brief' },
          scopes: ['meetings:read', 'tasks:read', 'notify:send'],
          assumptions: ['Runs at 8:30 AM on weekdays in your time zone.'],
        },
        'meeting-prep',
      ),
  },
  {
    id: 'message-to-task',
    name: 'Important message → task',
    description: 'Watches a channel; when a message needs action, creates a high-priority task for you and notifies you.',
    category: 'monitoring',
    icon: 'MessageSquareWarning',
    keywords: ['message arrives', 'client sends', 'important message', 'channel message', 'when a message', 'create a task whenever', 'whenever'],
    blueprint: () =>
      bp(
        {
          name: 'Important message → task',
          kind: 'automation',
          objective: 'Turn messages that need action into tasks, so requests never get lost in chat.',
          trigger: { kind: 'event', event: 'channel.message' },
          context: ['New messages in the chosen channel'],
          steps: [
            step({
              id: 'triage',
              kind: 'analyze',
              title: 'Decide if it needs action',
              why: 'Only requests, problems, deadlines and escalations become tasks',
              prompt:
                'Decide whether the message in the event needs action from us: a request, a problem, a deadline or an escalation. Reply with one word on the first line — IMPORTANT or ROUTINE — then one line with the reason.',
            }),
            step({ id: 'is_important', kind: 'condition', title: 'Is it important?', condition: 'triage.aiOutput contains "IMPORTANT"' }),
            step({ id: 'title', kind: 'generate', title: 'Write the task title', prompt: 'Write a task title of at most 80 characters for following up on this message. Reply with the title only.' }),
            step({
              id: 'task',
              kind: 'action',
              title: 'Create the task',
              tool: 'create_task',
              input: {
                title: '{{title.aiOutput}}',
                description: 'From {{event.senderName}} in #{{event.channelName}}:\n\n{{event.text}}\n\nWhy: {{triage.aiOutput}}',
                priority: 'HIGH',
                assignToMe: true,
              },
            }),
            step({ id: 'notify', kind: 'notify', title: 'Notify you', tool: 'notify_user', input: { title: 'New task from #{{event.channelName}}', body: '{{title.aiOutput}}' } }),
          ],
          output: { format: 'tasks', destination: 'notification', fromStep: 'triage' },
          scopes: ['tasks:write', 'notify:send'],
          assumptions: ['Only watches the channel you choose, and only channels you belong to.'],
        },
        'message-to-task',
      ),
  },
];

export function findAgentTemplate(id: string | undefined | null): AgentTemplateDefinition | undefined {
  return id ? AGENT_TEMPLATES.find((t) => t.id === id) : undefined;
}

/**
 * The template whose keywords best match a request, or null when nothing
 * matches well enough. Used only when AI planning is unavailable.
 */
export function matchAgentTemplate(request: string): { template: AgentTemplateDefinition; score: number } | null {
  const text = request.toLowerCase();
  let best: { template: AgentTemplateDefinition; score: number } | null = null;
  for (const template of AGENT_TEMPLATES) {
    let score = 0;
    for (const keyword of template.keywords) {
      if (text.includes(keyword)) score += keyword.length > 6 ? 3 : 2;
    }
    if (text.includes(template.name.toLowerCase())) score += 5;
    if (!best || score > best.score) best = { template, score };
  }
  return best && best.score >= 2 ? best : null;
}
