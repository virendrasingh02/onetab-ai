import { outputSchema as o, type AppActionDefinition } from '@org/types';

/**
 * What each connector action returns in `data`, by provider then action id.
 * The engine spreads `data` into the step's output, so a field here is
 * readable as `{{<stepId>.<field>}}` and offered in the canvas variable
 * picker. Only fields the adapter really returns are listed; an action with
 * no entry works as before, its fields just aren't listed.
 */
const person = o.object({ name: o.string(), email: o.string() });

const gmailMessage = o.object({
  id: o.string('Message id'),
  threadId: o.string(),
  from: person,
  to: o.array(person, 'Recipients'),
  subject: o.string(),
  snippet: o.string('Short preview'),
  bodyText: o.string('Plain-text body'),
  date: o.string('ISO date sent'),
  isRead: o.boolean(),
  labels: o.array(o.string()),
});

const calendarEvent = o.object({
  id: o.string(),
  summary: o.string('Title'),
  description: o.string(),
  location: o.string(),
  htmlLink: o.string('Link to the event'),
  start: o.string('Start (ISO)'),
  end: o.string('End (ISO)'),
  allDay: o.boolean(),
  attendees: o.array(o.object({ email: o.string(), name: o.string(), responseStatus: o.string() })),
  isRecurring: o.boolean(),
});

const slackChannel = o.object({
  id: o.string(),
  name: o.string(),
  is_private: o.boolean(),
  num_members: o.number(),
  topic: o.object({ value: o.string() }),
});

const slackMessage = o.object({
  ts: o.string('Message timestamp (also its id)'),
  text: o.string(),
  user: o.string('Sender’s Slack user id'),
  thread_ts: o.string('Thread parent timestamp'),
  permalink: o.string(),
});

const githubUser = o.object({ login: o.string() });
const githubIssue = o.object({
  number: o.number(),
  title: o.string(),
  state: o.string(),
  body: o.string(),
  html_url: o.string('Link'),
  user: githubUser,
  labels: o.array(o.object({ name: o.string() })),
  comments: o.number('Comment count'),
  created_at: o.string(),
  updated_at: o.string(),
});
const githubPull = o.object({
  number: o.number(),
  title: o.string(),
  state: o.string(),
  draft: o.boolean(),
  body: o.string(),
  html_url: o.string('Link'),
  user: githubUser,
  head: o.object({ ref: o.string('Source branch') }),
  base: o.object({ ref: o.string('Target branch') }),
  created_at: o.string(),
  updated_at: o.string(),
});

export const CONNECTOR_OUTPUT_SCHEMAS: Record<string, Record<string, Record<string, unknown>>> = {
  GMAIL: {
    search_messages: o.object({ messages: o.array(gmailMessage, 'Matching emails') }),
    get_thread: o.object({
      id: o.string('Thread id'),
      snippet: o.string(),
      messageCount: o.number(),
      messages: o.array(gmailMessage, 'Every message in the thread'),
    }),
    send_message: gmailMessage,
    reply_message: gmailMessage,
  },
  GOOGLE_CALENDAR: {
    list_events: o.object({ events: o.array(calendarEvent) }),
    search_events: o.object({ events: o.array(calendarEvent) }),
    get_event: o.object({ event: calendarEvent }),
    create_event: o.object({ event: calendarEvent }),
    check_availability: o.object({
      freeSlots: o.array(o.object({ start: o.string(), end: o.string() }), 'Free windows long enough for the duration'),
      busy: o.array(o.object({ start: o.string(), end: o.string() })),
      durationMinutes: o.number(),
    }),
  },
  GITHUB: {
    list_issues: o.object({ issues: o.array(githubIssue) }),
    get_issue: o.object({ issue: githubIssue }),
    create_issue: o.object({ issue: githubIssue }),
    search_issues: o.object({ results: o.array(githubIssue) }),
    list_pull_requests: o.object({ pullRequests: o.array(githubPull) }),
    get_pull_request: o.object({ pullRequest: githubPull }),
    list_review_requests: o.object({ pullRequests: o.array(githubPull) }),
  },
  SLACK: {
    list_channels: o.object({ channels: o.array(slackChannel) }),
    get_channel: o.object({ channel: slackChannel }),
    list_messages: o.object({ messages: o.array(slackMessage) }),
    get_thread: o.object({ messages: o.array(slackMessage) }),
    search_messages: o.object({ messages: o.array(slackMessage) }),
    send_message: o.object({ message: slackMessage, ts: o.string('Timestamp of the posted message') }),
    reply_in_thread: o.object({ message: slackMessage, ts: o.string('Timestamp of the reply') }),
  },
};


/** The actions with `outputSchema` filled in from the catalog (an adapter's own wins). */
export function withOutputSchemas(provider: string, actions: ReadonlyArray<AppActionDefinition>): AppActionDefinition[] {
  const known = CONNECTOR_OUTPUT_SCHEMAS[provider.toUpperCase()];
  if (!known) return [...actions];
  return actions.map((a) => (a.outputSchema || !known[a.id] ? a : { ...a, outputSchema: known[a.id] }));
}
