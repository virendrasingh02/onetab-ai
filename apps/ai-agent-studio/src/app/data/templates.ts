export interface WorkflowNodeData {
  label: string;
  subtitle?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'productivity' | 'engineering' | 'support' | 'multi-agent' | 'research';
  icon: string;
  recommendedModel: string;
  recommendedProvider: string;
  tags: string[];
  requiredTools: string[];
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: WorkflowNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    sourceHandle?: string;
  }>;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // 0. Shopify order -> Slack -> WhatsApp (one agent, three apps)
  {
    id: 'shopify-order-slack-whatsapp',
    name: 'Shopify Order Alerts: Slack + WhatsApp',
    description:
      'When a Shopify order arrives, tells your team on Slack. If the customer agreed to text updates and left a phone number, it asks you to approve, then sends them an approved WhatsApp template.',
    category: 'automation',
    icon: 'ShoppingBag',
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'openai',
    tags: ['Shopify', 'Slack', 'WhatsApp', 'Multi-app', 'Approval'],
    requiredTools: ['shopify.list_orders', 'slack.send_message', 'whatsapp.send_template_message'],
    nodes: [
      {
        id: 'order-1',
        type: 'APP_CONNECTOR_TRIGGER',
        position: { x: 50, y: 220 },
        data: {
          label: 'New Shopify order',
          subtitle: 'Checked every 2 minutes',
          config: { provider: 'SHOPIFY', connectorId: 'shopify', triggerId: 'new_order', input: {} },
        },
      },
      {
        id: 'slack-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 330, y: 220 },
        data: {
          label: 'Tell the team on Slack',
          subtitle: 'Pick a channel',
          config: {
            provider: 'SLACK',
            connectorId: 'slack',
            actionId: 'send_message',
            requireApproval: false,
            input: {
              channelId: '',
              text: 'New order {{event.name}}: {{event.totalPrice}} {{event.currency}} from {{event.customer.firstName}} {{event.customer.lastName}}',
            },
          },
        },
      },
      {
        id: 'consent-1',
        type: 'IF_ELSE',
        position: { x: 610, y: 220 },
        data: {
          label: 'Agreed to text updates?',
          subtitle: 'SMS consent is subscribed',
          config: { variable: 'event.customer.smsConsent', operator: 'equals', value: 'subscribed' },
        },
      },
      {
        id: 'phone-1',
        type: 'IF_ELSE',
        position: { x: 890, y: 130 },
        data: {
          label: 'Has a phone number?',
          subtitle: 'order phone is not empty',
          config: { variable: 'event.phone', operator: 'is_empty', value: '' },
        },
      },
      {
        id: 'whatsapp-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 1170, y: 60 },
        data: {
          label: 'Message the customer',
          subtitle: 'Needs an approved template',
          config: {
            provider: 'WHATSAPP',
            connectorId: 'whatsapp',
            actionId: 'send_template_message',
            requireApproval: true,
            input: {
              to: '{{event.phone}}',
              templateName: '',
              languageCode: 'en_US',
              bodyParameters: ['{{event.customer.firstName}}', '{{event.name}}'],
              // The branch above only reaches here when Shopify says the customer subscribed.
              customerOptedIn: true,
            },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1450, y: 220 },
        data: { label: 'Done', subtitle: 'Team told, customer messaged when eligible' },
      },
    ],
    edges: [
      { id: 'e-order-slack', source: 'order-1', target: 'slack-1' },
      { id: 'e-slack-consent', source: 'slack-1', target: 'consent-1' },
      { id: 'e-consent-phone', source: 'consent-1', target: 'phone-1', sourceHandle: 'true', label: 'Agreed' },
      { id: 'e-consent-end', source: 'consent-1', target: 'end-1', sourceHandle: 'false', label: 'No' },
      { id: 'e-phone-end', source: 'phone-1', target: 'end-1', sourceHandle: 'true', label: 'No phone' },
      { id: 'e-phone-wa', source: 'phone-1', target: 'whatsapp-1', sourceHandle: 'false', label: 'Has phone' },
      { id: 'e-wa-end', source: 'whatsapp-1', target: 'end-1' },
    ],
  },

  // 1. Office Auto Check-in & Check-out
  {
    id: 'office-auto-checkin-checkout',
    name: 'Office Auto Check-in & Check-out',
    description:
      'Checks you in when you arrive at the office and out when you leave, from your device’s location. Ignores imprecise GPS, waits a few minutes to confirm, and never punches twice.',
    category: 'automation',
    icon: 'MapPin',
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'openai',
    tags: ['Location', 'Attendance', 'Geofence', 'Slack'],
    requiredTools: ['attendance.check_in', 'attendance.check_out', 'slack.send_message'],
    nodes: [
      {
        id: 'geo-1',
        type: 'TRIGGER_LOCATION',
        position: { x: 50, y: 220 },
        data: {
          label: 'Arrive at / leave office',
          subtitle: 'Set the office location',
          // No coordinates on purpose: the agent can't be switched on until
          // the office's own latitude and longitude are set.
          config: {
            eventType: 'BOTH',
            officeName: 'Main office',
            radiusMeters: 100,
            dwellTimeMinutes: 3,
            accuracyThresholdMeters: 100,
            cooldownMinutes: 60,
          },
        },
      },
      {
        id: 'cond-1',
        type: 'IF_ELSE',
        position: { x: 330, y: 220 },
        data: {
          label: 'Arrived?',
          subtitle: 'location.event == ENTER',
          config: { variable: 'location.event', operator: 'equals', value: 'ENTER' },
        },
      },
      {
        id: 'punch-in',
        type: 'ATTENDANCE_ACTION',
        position: { x: 610, y: 130 },
        data: {
          label: 'Check in',
          subtitle: 'Attendance',
          config: {
            provider: 'ATTENDANCE',
            actionId: 'check_in',
            input: {
              locationName: '{{location.officeName}}',
              latitude: '{{location.latitude}}',
              longitude: '{{location.longitude}}',
              note: 'Automatic check-in on arrival',
            },
          },
        },
      },
      {
        id: 'punch-out',
        type: 'ATTENDANCE_ACTION',
        position: { x: 610, y: 310 },
        data: {
          label: 'Check out',
          subtitle: 'Attendance',
          config: {
            provider: 'ATTENDANCE',
            actionId: 'check_out',
            input: {
              locationName: '{{location.officeName}}',
              latitude: '{{location.latitude}}',
              longitude: '{{location.longitude}}',
              note: 'Automatic check-out on leaving',
            },
          },
        },
      },
      {
        id: 'notify',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 890, y: 220 },
        data: {
          label: 'Tell me on Slack',
          subtitle: 'Pick a channel or DM',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: { channelId: '', text: 'Attendance: {{toolResult.message}}' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1150, y: 220 },
        data: { label: 'Done', subtitle: 'Attendance recorded' },
      },
    ],
    edges: [
      { id: 'e-geo-cond', source: 'geo-1', target: 'cond-1' },
      { id: 'e-cond-in', source: 'cond-1', target: 'punch-in', sourceHandle: 'true', label: 'Arrived' },
      { id: 'e-cond-out', source: 'cond-1', target: 'punch-out', sourceHandle: 'false', label: 'Left' },
      { id: 'e-in-notify', source: 'punch-in', target: 'notify' },
      { id: 'e-out-notify', source: 'punch-out', target: 'notify' },
      { id: 'e-notify-end', source: 'notify', target: 'end-1' },
    ],
  },

  // 2. Daily Stand-up Assistant
  {
    id: 'daily-standup-assistant',
    name: 'Daily Stand-up Assistant',
    description:
      'Weekday 9:00 AM automation that aggregates yesterday’s merged commits, moved Trello tasks, and today’s agenda into a concise 3-part stand-up summary dispatched to Slack/Teams.',
    category: 'automation',
    icon: 'Clock',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['Schedule Cron', 'GitHub', 'Trello', 'Slack', 'Standup'],
    requiredTools: ['github.list_commits', 'trello.list_cards', 'slack.send_message'],
    nodes: [
      {
        id: 'cron-1',
        type: 'TRIGGER_SCHEDULE',
        position: { x: 50, y: 200 },
        data: {
          label: 'Weekday 9:00 AM Cron',
          subtitle: '0 9 * * 1-5',
          config: { cron: '0 9 * * 1-5', timezone: 'UTC' },
        },
      },
      {
        id: 'git-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 120 },
        data: {
          label: 'Fetch Git Commits',
          subtitle: 'Yesterday merged PRs & commits',
          config: { provider: 'GITHUB', actionId: 'list_commits', input: { repo: '' } },
        },
      },
      {
        id: 'trello-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 280 },
        data: {
          label: 'Fetch Trello Tasks',
          subtitle: 'Cards in Doing & Done',
          config: { provider: 'TRELLO', actionId: 'list_cards', input: { boardId: '' } },
        },
      },
      {
        id: 'agent-1',
        type: 'AGENT',
        position: { x: 590, y: 200 },
        data: {
          label: 'Stand-up Synthesizer',
          subtitle: 'Structure 3-part update',
          config: {
            instructions:
              'Analyze git activity ({{git-1.toolResult}}) and task updates ({{trello-1.toolResult}}). Output a formatted 3-part standup update:\n1. Completed Yesterday\n2. In Progress Today\n3. Blockers or Dependencies\nKeep concise with bullet points.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'slack-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 870, y: 200 },
        data: {
          label: 'Post to Standup Channel',
          subtitle: 'Broadcast to team Slack',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: { channelId: '', text: '{{agent-1.entityResponse}}' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1130, y: 200 },
        data: { label: 'Stand-up Dispatched', subtitle: 'Archived to execution logs' },
      },
    ],
    edges: [
      { id: 'e-cron-git', source: 'cron-1', target: 'git-1' },
      { id: 'e-cron-trello', source: 'cron-1', target: 'trello-1' },
      { id: 'e-git-agent', source: 'git-1', target: 'agent-1' },
      { id: 'e-trello-agent', source: 'trello-1', target: 'agent-1' },
      { id: 'e-agent-slack', source: 'agent-1', target: 'slack-1' },
      { id: 'e-slack-end', source: 'slack-1', target: 'end-1' },
    ],
  },

  // 3. Meeting Preparation & Follow-up
  {
    id: 'meeting-prep-followup',
    name: 'Meeting Preparation & Follow-up',
    description:
      'Prepares pre-meeting executive context from Google Calendar attendees & Gmail threads, pauses for human action items, and generates Trello follow-up cards.',
    category: 'productivity',
    icon: 'Calendar',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['Calendar', 'Gmail', 'Trello', 'Briefing', 'Action Items'],
    requiredTools: ['google_calendar.new_event', 'gmail.search_messages', 'trello.create_card'],
    nodes: [
      {
        id: 'cal-1',
        type: 'APP_CONNECTOR_TRIGGER',
        position: { x: 50, y: 200 },
        data: {
          label: 'Calendar Meeting Trigger',
          subtitle: '15 mins before event',
          config: { provider: 'GOOGLE_CALENDAR', triggerId: 'new_event', input: {} },
        },
      },
      {
        id: 'gmail-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 200 },
        data: {
          label: 'Search Past Threads',
          subtitle: 'Query recent email threads',
          config: { provider: 'GMAIL', actionId: 'search_messages', input: { query: 'from:{{event.attendees}}' } },
        },
      },
      {
        id: 'agent-1',
        type: 'AGENT',
        position: { x: 570, y: 200 },
        data: {
          label: 'Briefing Drafter',
          subtitle: 'Compile 1-page briefing',
          config: {
            instructions:
              'Compile an executive meeting briefing for {{event.summary}}. List attendees, open questions from {{gmail-1.toolResult}}, and target outcomes.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'approval-1',
        type: 'USER_APPROVAL',
        position: { x: 830, y: 200 },
        data: {
          label: 'Review & Input Notes',
          subtitle: 'Post-meeting review & tasks',
          config: { action: 'Confirm meeting notes & task creation', reviewPath: 'agent-1.entityResponse' },
        },
      },
      {
        id: 'trello-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 1090, y: 200 },
        data: {
          label: 'Create Follow-up Cards',
          subtitle: 'Sync tasks to Kanban',
          config: {
            provider: 'TRELLO',
            actionId: 'create_card',
            input: { listId: '', name: 'Follow-up: {{event.summary}}', description: 'Action items approved during meeting review.' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1330, y: 200 },
        data: { label: 'Meeting Concluded', subtitle: 'Action items tracked' },
      },
    ],
    edges: [
      { id: 'e-cal-gmail', source: 'cal-1', target: 'gmail-1' },
      { id: 'e-gmail-agent', source: 'gmail-1', target: 'agent-1' },
      { id: 'e-agent-appr', source: 'agent-1', target: 'approval-1' },
      { id: 'e-appr-trello', source: 'approval-1', target: 'trello-1' },
      { id: 'e-trello-end', source: 'trello-1', target: 'end-1' },
    ],
  },

  // 4. Smart Inbox & Message Triage
  {
    id: 'smart-inbox-triage',
    name: 'Smart Inbox & Message Triage',
    description:
      'Monitors inbound Gmail & Slack messages, classifies customer intent (Urgent Bug, Support, Lead, General), drafts personalized replies, and gates dispatch with human approval.',
    category: 'support',
    icon: 'Inbox',
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'openai',
    tags: ['Gmail', 'Intent Classifier', 'Human Approval', 'Email Automation'],
    requiredTools: ['gmail.new_email', 'gmail.send_message', 'intent_classifier'],
    nodes: [
      {
        id: 'inbox-1',
        type: 'APP_CONNECTOR_TRIGGER',
        position: { x: 50, y: 200 },
        data: {
          label: 'New Email Trigger',
          subtitle: 'Inbound message from inbox',
          config: { provider: 'GMAIL', triggerId: 'new_email', input: { query: 'in:inbox' } },
        },
      },
      {
        id: 'class-1',
        type: 'CLASSIFIER',
        position: { x: 310, y: 200 },
        data: {
          label: 'Intent Classifier',
          subtitle: 'Categorize customer message',
          config: { input: '{{event.body}}', categories: 'Urgent Bug,Support Request,Sales Inquiry,General' },
        },
      },
      {
        id: 'draft-1',
        type: 'LLM',
        position: { x: 570, y: 200 },
        data: {
          label: 'Draft Contextual Reply',
          subtitle: 'Personalized customer response',
          config: {
            prompt:
              'Draft a polite and helpful response to this {{class-1.classification}} email from {{event.sender}}:\nSubject: {{event.subject}}\nMessage: {{event.body}}',
          },
        },
      },
      {
        id: 'gate-1',
        type: 'USER_APPROVAL',
        position: { x: 830, y: 200 },
        data: {
          label: 'Human Review Gate',
          subtitle: 'Verify draft before sending',
          config: { action: 'Approve sending drafted email reply', reviewPath: 'draft-1.aiOutput' },
        },
      },
      {
        id: 'send-1',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 1090, y: 200 },
        data: {
          label: 'Send Verified Reply',
          subtitle: 'Deliver email via Gmail',
          config: {
            provider: 'GMAIL',
            actionId: 'send_message',
            input: { to: '{{event.sender}}', subject: 'Re: {{event.subject}}', bodyText: '{{gate-1.reviewed}}' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1330, y: 200 },
        data: { label: 'Email Dispatched', subtitle: 'Ticket closed & logged' },
      },
    ],
    edges: [
      { id: 'e-inbox-class', source: 'inbox-1', target: 'class-1' },
      { id: 'e-class-draft', source: 'class-1', target: 'draft-1' },
      { id: 'e-draft-gate', source: 'draft-1', target: 'gate-1' },
      { id: 'e-gate-send', source: 'gate-1', target: 'send-1' },
      { id: 'e-send-end', source: 'send-1', target: 'end-1' },
    ],
  },

  // 5. Project & Trello Task Coordinator
  {
    id: 'project-task-coordinator',
    name: 'Project & Trello Task Coordinator',
    description:
      'Monitors Trello card movements, validates completeness, syncs matching GitHub issues, and triggers escalation alerts on Slack when items are overdue.',
    category: 'automation',
    icon: 'CheckSquare',
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'openai',
    tags: ['Trello', 'GitHub', 'Slack', 'Cross-Sync', 'Overdue Escalation'],
    requiredTools: ['trello.new_card', 'github.comment_on_issue', 'slack.send_message'],
    nodes: [
      {
        id: 'trello-trig',
        type: 'APP_CONNECTOR_TRIGGER',
        position: { x: 50, y: 200 },
        data: {
          label: 'Trello Card Moved',
          subtitle: 'Card moved to Done/Doing',
          config: { provider: 'TRELLO', triggerId: 'new_card', input: {} },
        },
      },
      {
        id: 'cond-overdue',
        type: 'CONDITION',
        position: { x: 310, y: 200 },
        data: {
          label: 'Has a due date?',
          subtitle: 'card.due is set',
          config: { variable: 'event.due', operator: 'is_not_empty', value: '' },
        },
      },
      {
        id: 'alert-slack',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 590, y: 120 },
        data: {
          label: 'Escalate to Slack',
          subtitle: 'Alert project channel',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: { channelId: '', text: 'Overdue task: {{event.cardName}} is past due date!' },
          },
        },
      },
      {
        id: 'sync-git',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 590, y: 280 },
        data: {
          label: 'Sync to GitHub Issue',
          subtitle: 'Update issue state',
          config: {
            provider: 'GITHUB',
            actionId: 'comment_on_issue',
            input: { repo: '', issueNumber: '', body: 'Linked Trello card {{event.name}} is on track.' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 870, y: 200 },
        data: { label: 'Coordination Synced', subtitle: 'All boards updated' },
      },
    ],
    edges: [
      { id: 'e-trig-cond', source: 'trello-trig', target: 'cond-overdue' },
      { id: 'e-cond-alert', source: 'cond-overdue', target: 'alert-slack', sourceHandle: 'true', label: 'Has due date' },
      { id: 'e-cond-sync', source: 'cond-overdue', target: 'sync-git', sourceHandle: 'false', label: 'No due date' },
      { id: 'e-alert-sync', source: 'alert-slack', target: 'sync-git' },
      { id: 'e-sync-end', source: 'sync-git', target: 'end-1' },
    ],
  },

  // 6. Git Pull Request & CI Monitor
  {
    id: 'git-pr-ci-monitor',
    name: 'Git Pull Request & CI Monitor',
    description:
      'Tracks GitHub pull requests, runs automated risk and architectural reviews, pings reviewers on Slack, and creates blocker cards in Trello if CI checks fail.',
    category: 'engineering',
    icon: 'GitPullRequest',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['GitHub PR', 'CI/CD', 'Code Review', 'Slack', 'Trello Blockers'],
    requiredTools: ['github.new_pull_request', 'slack.send_message', 'trello.create_card'],
    nodes: [
      {
        id: 'pr-1',
        type: 'APP_CONNECTOR_TRIGGER',
        position: { x: 50, y: 200 },
        data: {
          label: 'GitHub PR Opened',
          subtitle: 'Inbound Pull Request',
          config: { provider: 'GITHUB', triggerId: 'new_pull_request', input: { repo: '' } },
        },
      },
      {
        id: 'agent-rev',
        type: 'AGENT',
        position: { x: 310, y: 200 },
        data: {
          label: 'Architectural Reviewer',
          subtitle: 'Evaluate diff & risk',
          config: {
            instructions:
              'Review the pull request diff for PR #{{event.number}}: {{event.title}}. Check for breaking API changes, unindexed DB queries, and missing tests. Provide a 3-bullet executive assessment.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'cond-ci',
        type: 'CONDITION',
        position: { x: 570, y: 200 },
        data: {
          label: 'Is it a draft?',
          subtitle: 'pull_request.draft',
          config: { variable: 'event.draft', operator: 'equals', value: 'true' },
        },
      },
      {
        id: 'trello-block',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 830, y: 120 },
        data: {
          label: 'Create Blocker Card',
          subtitle: 'Add to Trello Blockers list',
          config: {
            provider: 'TRELLO',
            actionId: 'create_card',
            input: {
              listId: '',
              name: 'Draft PR #{{event.number}}: {{event.title}}',
              description: 'Opened as a draft by {{event.user.login}}.',
            },
          },
        },
      },
      {
        id: 'slack-notif',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 830, y: 280 },
        data: {
          label: 'Notify Dev Channel',
          subtitle: 'Review alert on Slack',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: {
              channelId: '',
              text: 'New PR #{{event.number}}: {{event.title}} by @{{event.user.login}}.\n{{agent-rev.entityResponse}}',
            },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1090, y: 200 },
        data: { label: 'Monitoring Active', subtitle: 'Reviewers alerted' },
      },
    ],
    edges: [
      { id: 'e-pr-rev', source: 'pr-1', target: 'agent-rev' },
      { id: 'e-rev-ci', source: 'agent-rev', target: 'cond-ci' },
      { id: 'e-ci-block', source: 'cond-ci', target: 'trello-block', sourceHandle: 'true', label: 'Draft' },
      { id: 'e-ci-notif', source: 'cond-ci', target: 'slack-notif', sourceHandle: 'false', label: 'Ready for review' },
      { id: 'e-block-notif', source: 'trello-block', target: 'slack-notif' },
      { id: 'e-notif-end', source: 'slack-notif', target: 'end-1' },
    ],
  },

  // 7. Cross-App Work Coordinator
  {
    id: 'cross-app-coordinator',
    name: 'Cross-App Work Coordinator',
    description:
      'Correlates events across Jira, GitHub, Trello, and Microsoft Teams. When an issue closes, updates downstream trackers and sends team notifications.',
    category: 'multi-agent',
    icon: 'Layers',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['Cross-App', 'GitHub', 'Trello', 'Teams', 'Multi-Connector'],
    requiredTools: ['trello.update_card', 'microsoft_teams.send_channel_message'],
    nodes: [
      {
        id: 'ev-in',
        type: 'TRIGGER_APP_EVENT',
        position: { x: 50, y: 200 },
        data: {
          label: 'Work Item Closed',
          subtitle: 'Internal platform event',
          config: { eventType: 'task.completed' },
        },
      },
      {
        id: 'correlate',
        type: 'AGENT',
        position: { x: 310, y: 200 },
        data: {
          label: 'Record Correlator',
          subtitle: 'Map foreign IDs & repos',
          config: {
            instructions:
              'Correlate completed task {{event.taskId}} with its external GitHub PR and Trello card ID. Return mapping JSON.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'trello-sync',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 570, y: 200 },
        data: {
          label: 'Update Trello Card',
          subtitle: 'Move card to Done',
          config: {
            provider: 'TRELLO',
            actionId: 'update_card',
            input: { cardId: '{{correlate.entityResponse.cardId}}', dueComplete: true },
          },
        },
      },
      {
        id: 'teams-msg',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 830, y: 200 },
        data: {
          label: 'Post to Teams Channel',
          subtitle: 'Broadcast to Engineering Team',
          config: {
            provider: 'MICROSOFT_TEAMS',
            actionId: 'send_channel_message',
            input: {
              teamId: '',
              channelId: '',
              content: 'Milestone item completed: {{event.taskTitle}} synchronized across all tools.',
            },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1090, y: 200 },
        data: { label: 'Ecosystem Synchronized', subtitle: 'Multi-app state verified' },
      },
    ],
    edges: [
      { id: 'e-ev-corr', source: 'ev-in', target: 'correlate' },
      { id: 'e-corr-trello', source: 'correlate', target: 'trello-sync' },
      { id: 'e-trello-teams', source: 'trello-sync', target: 'teams-msg' },
      { id: 'e-teams-end', source: 'teams-msg', target: 'end-1' },
    ],
  },

  // 8. Daily Focus & Deadline Guardian
  {
    id: 'daily-focus-guardian',
    name: 'Daily Focus & Deadline Guardian',
    description:
      'Morning executive briefing bot. Scans Trello boards, Calendar schedules, and outstanding PR reviews. Produces a prioritized Top-3 focus list and sends direct desktop/Slack briefing.',
    category: 'productivity',
    icon: 'Target',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['Focus', 'Eisenhower Matrix', 'Calendar', 'Trello', 'Slack'],
    requiredTools: ['trello.list_cards', 'google_calendar.list_events', 'slack.send_message'],
    nodes: [
      {
        id: 'morn-cron',
        type: 'TRIGGER_SCHEDULE',
        position: { x: 50, y: 200 },
        data: {
          label: '8:00 AM Daily Trigger',
          subtitle: '0 8 * * 1-5',
          config: { cron: '0 8 * * 1-5', timezone: 'UTC' },
        },
      },
      {
        id: 'fetch-trello',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 120 },
        data: {
          label: 'Scan Assigned Tasks',
          subtitle: 'Trello open cards',
          config: { provider: 'TRELLO', actionId: 'list_cards', input: { boardId: '' } },
        },
      },
      {
        id: 'fetch-cal',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 280 },
        data: {
          label: 'Scan Calendar Schedule',
          subtitle: 'Today meetings & events',
          config: { provider: 'GOOGLE_CALENDAR', actionId: 'list_events', input: {} },
        },
      },
      {
        id: 'prioritize',
        type: 'AGENT',
        position: { x: 590, y: 200 },
        data: {
          label: 'Eisenhower Prioritizer',
          subtitle: 'Identify top 3 MITs',
          config: {
            instructions:
              'Review tasks ({{fetch-trello.toolResult}}) and meetings ({{fetch-cal.toolResult}}). Rank items into Urgent vs Important. Select exactly 3 Most Important Tasks for today.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'send-focus',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 870, y: 200 },
        data: {
          label: 'Send Focus Digest',
          subtitle: 'DM to user via Slack',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: { channelId: '', text: 'Your Daily Focus Agenda for {{now.long}}:\n{{prioritize.entityResponse}}' },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1130, y: 200 },
        data: { label: 'Focus Agenda Set', subtitle: 'Daily briefing delivered' },
      },
    ],
    edges: [
      { id: 'e-morn-trello', source: 'morn-cron', target: 'fetch-trello' },
      { id: 'e-morn-cal', source: 'morn-cron', target: 'fetch-cal' },
      { id: 'e-trello-prio', source: 'fetch-trello', target: 'prioritize' },
      { id: 'e-cal-prio', source: 'fetch-cal', target: 'prioritize' },
      { id: 'e-prio-send', source: 'prioritize', target: 'send-focus' },
      { id: 'e-send-end', source: 'send-focus', target: 'end-1' },
    ],
  },

  // 9. End-of-Day Work Summary
  {
    id: 'end-of-day-summary',
    name: 'End-of-Day Work Summary',
    description:
      'Automatically collects completed pull requests, moved Kanban cards, and meetings attended at 5:30 PM. Compiles an accomplishments digest and emails it to your journal or team lead.',
    category: 'productivity',
    icon: 'FileCheck',
    recommendedModel: 'gpt-4o',
    recommendedProvider: 'openai',
    tags: ['EOD Summary', 'GitHub', 'Trello', 'Gmail', 'Accomplishments'],
    requiredTools: ['github.list_commits', 'trello.list_cards', 'gmail.send_message'],
    nodes: [
      {
        id: 'eod-cron',
        type: 'TRIGGER_SCHEDULE',
        position: { x: 50, y: 200 },
        data: {
          label: '5:30 PM EOD Cron',
          subtitle: '30 17 * * 1-5',
          config: { cron: '30 17 * * 1-5', timezone: 'UTC' },
        },
      },
      {
        id: 'git-done',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 120 },
        data: {
          label: 'Fetch Git Activity',
          subtitle: 'Commits & merged PRs today',
          config: { provider: 'GITHUB', actionId: 'list_commits', input: { repo: '' } },
        },
      },
      {
        id: 'trello-done',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 310, y: 280 },
        data: {
          label: 'Fetch Completed Tasks',
          subtitle: 'Cards moved to Done today',
          config: { provider: 'TRELLO', actionId: 'list_cards', input: { boardId: '' } },
        },
      },
      {
        id: 'digest-ai',
        type: 'AGENT',
        position: { x: 590, y: 200 },
        data: {
          label: 'Accomplishment Digest',
          subtitle: 'Synthesize work log',
          config: {
            instructions:
              'Synthesize today git work ({{git-done.toolResult}}) and completed tasks ({{trello-done.toolResult}}). Write a clean markdown EOD summary with: 1. Highlights, 2. Closed Items, 3. Tomorrow Priorities.',
            model: 'gpt-4o',
          },
        },
      },
      {
        id: 'mail-eod',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 870, y: 200 },
        data: {
          label: 'Email EOD Journal',
          subtitle: 'Send to self / manager',
          config: {
            provider: 'GMAIL',
            actionId: 'send_message',
            input: {
              to: '',
              subject: 'EOD Accomplishments Digest - {{now.date}}',
              bodyText: '{{digest-ai.entityResponse}}',
            },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1130, y: 200 },
        data: { label: 'EOD Logged', subtitle: 'Accomplishments archived' },
      },
    ],
    edges: [
      { id: 'e-eod-git', source: 'eod-cron', target: 'git-done' },
      { id: 'e-eod-trello', source: 'eod-cron', target: 'trello-done' },
      { id: 'e-git-digest', source: 'git-done', target: 'digest-ai' },
      { id: 'e-trello-digest', source: 'trello-done', target: 'digest-ai' },
      { id: 'e-digest-mail', source: 'digest-ai', target: 'mail-eod' },
      { id: 'e-mail-end', source: 'mail-eod', target: 'end-1' },
    ],
  },

  // 10. Personal Admin & Renewal Reminder
  {
    id: 'personal-admin-renewal',
    name: 'Personal Admin & Renewal Reminder',
    description:
      'Scans subscriptions, domain expirations, and contracts weekly. Detects renewal thresholds (< 14 days), checks pricing changes, and prompts human approval before auto-renewing.',
    category: 'automation',
    icon: 'CreditCard',
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'openai',
    tags: ['Subscriptions', 'Renewals', 'Human Approval', 'Cost Optimization'],
    requiredTools: ['http_request', 'structured_output', 'human_approval', 'slack.send_message'],
    nodes: [
      {
        id: 'week-cron',
        type: 'TRIGGER_SCHEDULE',
        position: { x: 50, y: 200 },
        data: {
          label: 'Weekly Scan Cron',
          subtitle: '0 10 * * 1 (Every Monday)',
          config: { cron: '0 10 * * 1', timezone: 'UTC' },
        },
      },
      {
        id: 'fetch-api',
        type: 'HTTP_REQUEST',
        position: { x: 310, y: 200 },
        data: {
          label: 'Fetch Subscriptions API',
          subtitle: 'Query active services',
          config: { method: 'GET', url: 'https://api.example.com/subscriptions' },
        },
      },
      {
        id: 'extract-exp',
        type: 'STRUCTURED_OUTPUT',
        position: { x: 570, y: 200 },
        data: {
          label: 'Extract Renewal Dates',
          subtitle: 'Parse daysRemaining & cost',
          config: { fields: 'serviceName,daysRemaining,cost,plan', input: '{{fetch-api.body}}' },
        },
      },
      {
        id: 'cond-exp',
        type: 'CONDITION',
        position: { x: 830, y: 200 },
        data: {
          label: 'Expires in <= 14 Days?',
          subtitle: 'Threshold check',
          config: { variable: 'daysRemaining', operator: 'less_than', value: '15' },
        },
      },
      {
        id: 'gate-renew',
        type: 'USER_APPROVAL',
        position: { x: 1090, y: 120 },
        data: {
          label: 'Approve Renewal Budget',
          subtitle: 'Human signoff on cost',
          config: { action: 'Approve renewal expenditure', reviewPath: 'extract-exp.extracted' },
        },
      },
      {
        id: 'alert-finance',
        type: 'APP_CONNECTOR_ACTION',
        position: { x: 1350, y: 200 },
        data: {
          label: 'Notify Finance Slack',
          subtitle: 'Post renewal status',
          config: {
            provider: 'SLACK',
            actionId: 'send_message',
            input: {
              channelId: '',
              text: 'Renewal approved for {{extract-exp.extracted.serviceName}} (${{extract-exp.extracted.cost}}).',
            },
          },
        },
      },
      {
        id: 'end-1',
        type: 'END',
        position: { x: 1590, y: 200 },
        data: { label: 'Renewals Verified', subtitle: 'Logged & confirmed' },
      },
    ],
    edges: [
      { id: 'e-week-fetch', source: 'week-cron', target: 'fetch-api' },
      { id: 'e-fetch-extract', source: 'fetch-api', target: 'extract-exp' },
      { id: 'e-extract-cond', source: 'extract-exp', target: 'cond-exp' },
      { id: 'e-cond-gate', source: 'cond-exp', target: 'gate-renew', sourceHandle: 'true', label: 'Expiring Soon' },
      { id: 'e-cond-end', source: 'cond-exp', target: 'end-1', sourceHandle: 'false', label: 'Healthy' },
      { id: 'e-gate-alert', source: 'gate-renew', target: 'alert-finance' },
      { id: 'e-alert-end', source: 'alert-finance', target: 'end-1' },
    ],
  },
];
