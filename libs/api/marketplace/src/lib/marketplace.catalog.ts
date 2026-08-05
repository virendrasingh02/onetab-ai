import type { PublishListingInput } from './marketplace.types.js';

/**
 * First-party catalog seeded into an empty marketplace.
 *
 * These are the listings the seven storefronts open with, so a fresh install is
 * a working marketplace rather than seven empty pages. Seeding upserts by slug,
 * so editing an entry here and re-running the seed updates the live listing.
 */
export const BUILT_IN_CATALOG: PublishListingInput[] = [
  // --- Plugin SDK ----------------------------------------------------------
  {
    kind: 'PLUGIN',
    slug: 'standup-summarizer',
    name: 'Standup Summarizer',
    tagline: 'Turns yesterday’s channel chatter into a three-line standup.',
    description:
      'Reads the channels you point it at, groups activity by author, and posts a digest every morning. Runs entirely in the sandbox — no data leaves the workspace.',
    category: 'Productivity',
    tags: ['standup', 'summary', 'ai'],
    publisherSlug: 'onetab-labs',
    publisherName: 'OneTab Labs',
    manifest: {
      runtime: 'SANDBOXED_JS',
      entryPoint: 'dist/plugin.js',
      scopes: ['read:channels', 'read:messages', 'write:messages', 'ai:invoke'],
      surfaces: ['channel.toolbar', 'command.palette'],
    },
  },
  {
    kind: 'PLUGIN',
    slug: 'pr-review-radar',
    name: 'PR Review Radar',
    tagline: 'Surfaces pull requests waiting on you, wherever you are.',
    description:
      'Adds a sidebar panel listing every PR that has your review requested, sorted by how long it has been sitting.',
    category: 'Developer',
    tags: ['github', 'reviews', 'engineering'],
    publisherSlug: 'forge-tools',
    publisherName: 'Forge Tools',
    manifest: {
      runtime: 'WEBHOOK',
      webhookUrl: 'https://plugins.forgetools.dev/pr-radar',
      scopes: ['read:members', 'net:fetch', 'ui:surface'],
      surfaces: ['sidebar.panel'],
    },
  },
  {
    kind: 'PLUGIN',
    slug: 'meeting-notes-capture',
    name: 'Meeting Notes Capture',
    tagline: 'One click from a calendar event to a structured notes doc.',
    description:
      'Creates a document pre-filled with attendees, agenda and action-item sections whenever a meeting starts.',
    category: 'Productivity',
    tags: ['meetings', 'docs'],
    publisherSlug: 'onetab-labs',
    manifest: {
      runtime: 'SANDBOXED_JS',
      entryPoint: 'dist/capture.js',
      scopes: ['read:members', 'write:documents'],
      surfaces: ['command.palette', 'document.toolbar'],
    },
  },
  {
    kind: 'PLUGIN',
    slug: 'secret-scanner',
    name: 'Secret Scanner',
    tagline: 'Flags API keys and tokens pasted into channels.',
    description:
      'Scans outgoing messages for credential-shaped strings and warns the sender before the message lands.',
    category: 'Security',
    tags: ['security', 'compliance', 'dlp'],
    publisherSlug: 'sentinel-io',
    publisherName: 'Sentinel IO',
    pricingModel: 'PAID',
    priceCents: 900,
    manifest: {
      runtime: 'SANDBOXED_JS',
      entryPoint: 'dist/scanner.js',
      scopes: ['read:messages', 'ui:surface'],
      surfaces: ['channel.message.action', 'global.modal'],
    },
  },
  {
    kind: 'PLUGIN',
    slug: 'timezone-buddy',
    name: 'Timezone Buddy',
    tagline: 'Shows every teammate’s local time inline.',
    description:
      'Annotates mentions and member lists with the recipient’s local time so nobody gets pinged at 3am.',
    category: 'Utilities',
    tags: ['timezones', 'remote'],
    publisherSlug: 'community',
    publisherName: 'Community',
    manifest: {
      runtime: 'SANDBOXED_JS',
      entryPoint: 'dist/tz.js',
      scopes: ['read:members', 'ui:surface'],
      surfaces: ['channel.message.action'],
    },
  },

  // --- Theme Store ---------------------------------------------------------
  {
    kind: 'THEME',
    slug: 'midnight-slate',
    name: 'Midnight Slate',
    tagline: 'The default dark theme, dialled a little cooler.',
    category: 'Dark',
    tags: ['dark', 'default'],
    publisherSlug: 'onetab-labs',
    payload: {
      colors: {
        background: '#020617',
        surface: '#0f172a',
        border: '#1e293b',
        accent: '#3b82f6',
        foreground: '#e2e8f0',
      },
    },
  },
  {
    kind: 'THEME',
    slug: 'paper-light',
    name: 'Paper Light',
    tagline: 'Warm, low-glare light theme for long reading sessions.',
    category: 'Light',
    tags: ['light', 'reading'],
    publisherSlug: 'onetab-labs',
    payload: {
      colors: {
        background: '#fdfcf9',
        surface: '#ffffff',
        border: '#e7e2d8',
        accent: '#b45309',
        foreground: '#1c1917',
      },
    },
  },
  {
    kind: 'THEME',
    slug: 'neon-terminal',
    name: 'Neon Terminal',
    tagline: 'Green-on-black, for people who never left the CRT era.',
    category: 'Dark',
    tags: ['dark', 'retro', 'terminal'],
    publisherSlug: 'community',
    payload: {
      colors: {
        background: '#000000',
        surface: '#0a0f0a',
        border: '#14532d',
        accent: '#22c55e',
        foreground: '#bbf7d0',
      },
    },
  },
  {
    kind: 'THEME',
    slug: 'high-contrast-accessible',
    name: 'High Contrast Accessible',
    tagline: 'WCAG AAA contrast on every text pairing.',
    description:
      'Every foreground/background combination in this theme clears a 7:1 contrast ratio, including disabled and placeholder states.',
    category: 'High Contrast',
    tags: ['accessibility', 'wcag', 'contrast'],
    publisherSlug: 'onetab-labs',
    payload: {
      colors: {
        background: '#000000',
        surface: '#0b0b0b',
        border: '#ffffff',
        accent: '#ffd400',
        foreground: '#ffffff',
      },
    },
  },
  {
    kind: 'THEME',
    slug: 'brand-kit-studio',
    name: 'Brand Kit Studio',
    tagline: 'Drop in your brand hex codes and generate a full theme.',
    category: 'Brand',
    tags: ['brand', 'custom', 'enterprise'],
    publisherSlug: 'pixelforge',
    publisherName: 'PixelForge',
    pricingModel: 'PAID',
    priceCents: 2400,
    payload: {
      colors: {
        background: '#0b1020',
        surface: '#141b34',
        border: '#243056',
        accent: '#7c3aed',
        foreground: '#e9ecf8',
      },
      configurable: true,
    },
  },

  // --- Agent Marketplace ---------------------------------------------------
  {
    kind: 'AGENT',
    slug: 'support-triage-agent',
    name: 'Support Triage Agent',
    tagline: 'Reads inbound tickets, tags them, routes them.',
    description:
      'Classifies each incoming support message by urgency and product area, then assigns it to the on-call rotation.',
    category: 'Support',
    tags: ['support', 'triage', 'routing'],
    publisherSlug: 'onetab-labs',
    payload: {
      model: 'claude-sonnet-5',
      tools: ['search', 'tasks.create', 'members.read'],
      systemPrompt:
        'You triage inbound support requests. Classify urgency, identify the product area, and assign an owner.',
    },
  },
  {
    kind: 'AGENT',
    slug: 'code-reviewer-agent',
    name: 'Code Reviewer',
    tagline: 'A first-pass review before a human opens the diff.',
    category: 'Engineering',
    tags: ['code-review', 'engineering', 'quality'],
    publisherSlug: 'forge-tools',
    payload: {
      model: 'claude-opus-5',
      tools: ['repo.read', 'comments.write'],
      systemPrompt:
        'Review the diff for correctness, missing tests, and error handling. Be specific and cite line numbers.',
    },
  },
  {
    kind: 'AGENT',
    slug: 'research-analyst-agent',
    name: 'Research Analyst',
    tagline: 'Turns a question into a sourced brief.',
    category: 'Research',
    tags: ['research', 'analysis', 'reports'],
    publisherSlug: 'onetab-labs',
    payload: {
      model: 'claude-opus-5',
      tools: ['web.search', 'documents.write'],
      systemPrompt:
        'Answer the question with a structured brief. Cite every claim and flag anything you could not verify.',
    },
  },
  {
    kind: 'AGENT',
    slug: 'sales-followup-agent',
    name: 'Sales Follow-Up',
    tagline: 'Drafts the follow-up nobody got round to sending.',
    category: 'Sales',
    tags: ['sales', 'crm', 'outreach'],
    publisherSlug: 'revenue-stack',
    publisherName: 'Revenue Stack',
    pricingModel: 'FREEMIUM',
    payload: {
      model: 'claude-sonnet-5',
      tools: ['crm.read', 'messages.write'],
      systemPrompt:
        'Draft a short, specific follow-up referencing what was actually discussed. Never invent commitments.',
    },
  },
  {
    kind: 'AGENT',
    slug: 'incident-commander-agent',
    name: 'Incident Commander',
    tagline: 'Opens the channel, pages the owner, keeps the timeline.',
    category: 'Operations',
    tags: ['incidents', 'oncall', 'sre'],
    publisherSlug: 'sentinel-io',
    payload: {
      model: 'claude-sonnet-5',
      tools: ['channels.create', 'members.read', 'documents.write'],
      systemPrompt:
        'Coordinate the incident: open a channel, page the service owner, and maintain a running timeline.',
    },
  },

  // --- Workflow Templates --------------------------------------------------
  {
    kind: 'WORKFLOW',
    slug: 'new-hire-onboarding',
    name: 'New Hire Onboarding',
    tagline: 'Twelve first-week tasks, created the moment someone joins.',
    category: 'Onboarding',
    tags: ['hr', 'onboarding', 'checklist'],
    publisherSlug: 'onetab-labs',
    payload: {
      trigger: { type: 'MEMBER_JOINED' },
      steps: [
        { type: 'CREATE_TASKS', template: 'first-week-checklist' },
        { type: 'INVITE_TO_CHANNELS', channels: ['general', 'announcements'] },
        { type: 'SEND_MESSAGE', target: 'new-member', template: 'welcome' },
        { type: 'SCHEDULE_EVENT', title: '30-day check-in', offsetDays: 30 },
      ],
    },
  },
  {
    kind: 'WORKFLOW',
    slug: 'deploy-notification',
    name: 'Deploy Notification',
    tagline: 'Announces every production deploy with its changelog.',
    category: 'Engineering',
    tags: ['ci', 'deploys', 'releases'],
    publisherSlug: 'forge-tools',
    payload: {
      trigger: { type: 'WEBHOOK', source: 'ci' },
      steps: [
        { type: 'FETCH_CHANGELOG' },
        { type: 'SEND_MESSAGE', target: 'channel:releases' },
        { type: 'UPDATE_DOCUMENT', document: 'release-log' },
      ],
    },
  },
  {
    kind: 'WORKFLOW',
    slug: 'incident-escalation',
    name: 'Incident Escalation',
    tagline: 'Page, escalate, and open a war room on a failing alert.',
    category: 'Alerts',
    tags: ['incidents', 'alerts', 'escalation'],
    publisherSlug: 'sentinel-io',
    payload: {
      trigger: { type: 'ALERT', severity: 'CRITICAL' },
      steps: [
        { type: 'CREATE_CHANNEL', namePattern: 'incident-{{date}}' },
        { type: 'PAGE_ONCALL' },
        { type: 'WAIT', minutes: 15 },
        { type: 'ESCALATE', to: 'engineering-lead' },
      ],
    },
  },
  {
    kind: 'WORKFLOW',
    slug: 'weekly-metrics-digest',
    name: 'Weekly Metrics Digest',
    tagline: 'Monday-morning numbers, posted before anyone asks.',
    category: 'Reporting',
    tags: ['analytics', 'reporting', 'weekly'],
    publisherSlug: 'onetab-labs',
    payload: {
      trigger: { type: 'SCHEDULE', cron: '0 9 * * MON' },
      steps: [
        { type: 'RUN_REPORT', report: 'workspace-activity' },
        { type: 'FORMAT_DIGEST' },
        { type: 'SEND_MESSAGE', target: 'channel:leadership' },
      ],
    },
  },
  {
    kind: 'WORKFLOW',
    slug: 'document-approval',
    name: 'Document Approval',
    tagline: 'Routes a doc through reviewers and records the sign-off.',
    category: 'Approvals',
    tags: ['approvals', 'docs', 'compliance'],
    publisherSlug: 'community',
    payload: {
      trigger: { type: 'DOCUMENT_SUBMITTED' },
      steps: [
        { type: 'REQUEST_APPROVAL', approvers: ['doc-owner', 'legal'] },
        { type: 'WAIT_FOR_ALL' },
        { type: 'STAMP_APPROVED' },
        { type: 'NOTIFY_AUTHOR' },
      ],
    },
  },

  // --- Component Marketplace ----------------------------------------------
  {
    kind: 'COMPONENT',
    slug: 'metric-tile',
    name: 'Metric Tile',
    tagline: 'A stat tile with trend arrow and sparkline.',
    category: 'Charts',
    tags: ['react', 'dashboard', 'stats'],
    publisherSlug: 'pixelforge',
    payload: {
      framework: 'react',
      props: ['label', 'value', 'delta', 'series'],
      source: 'export function MetricTile({ label, value, delta, series }) { /* … */ }',
    },
  },
  {
    kind: 'COMPONENT',
    slug: 'split-pane-layout',
    name: 'Split Pane Layout',
    tagline: 'Resizable, keyboard-accessible two-pane layout.',
    category: 'Layout',
    tags: ['react', 'layout', 'a11y'],
    publisherSlug: 'pixelforge',
    payload: {
      framework: 'react',
      props: ['left', 'right', 'defaultRatio', 'minWidth'],
      source: 'export function SplitPane({ left, right, defaultRatio = 0.5 }) { /* … */ }',
    },
  },
  {
    kind: 'COMPONENT',
    slug: 'multi-step-form',
    name: 'Multi-Step Form',
    tagline: 'Wizard form with per-step validation and a progress rail.',
    category: 'Forms',
    tags: ['react', 'forms', 'validation'],
    publisherSlug: 'community',
    payload: {
      framework: 'react',
      props: ['steps', 'onComplete', 'schema'],
      source: 'export function MultiStepForm({ steps, onComplete, schema }) { /* … */ }',
    },
  },
  {
    kind: 'COMPONENT',
    slug: 'toast-stack',
    name: 'Toast Stack',
    tagline: 'Queued, screen-reader-announced notifications.',
    category: 'Feedback',
    tags: ['react', 'notifications', 'a11y'],
    publisherSlug: 'onetab-labs',
    payload: {
      framework: 'react',
      props: ['position', 'maxVisible', 'duration'],
      source: 'export function ToastStack({ position = "bottom-right" }) { /* … */ }',
    },
  },
  {
    kind: 'COMPONENT',
    slug: 'command-bar',
    name: 'Command Bar',
    tagline: 'Fuzzy-searching command palette with grouped results.',
    category: 'Navigation',
    tags: ['react', 'search', 'keyboard'],
    publisherSlug: 'pixelforge',
    pricingModel: 'FREEMIUM',
    payload: {
      framework: 'react',
      props: ['commands', 'placeholder', 'hotkey'],
      source: 'export function CommandBar({ commands, hotkey = "mod+k" }) { /* … */ }',
    },
  },

  // --- Integration Store ---------------------------------------------------
  {
    kind: 'INTEGRATION',
    slug: 'github-integration',
    name: 'GitHub',
    tagline: 'Issue sync, PR reviews and commit webhooks.',
    category: 'Dev Tools',
    tags: ['github', 'git', 'engineering'],
    publisherSlug: 'onetab-labs',
    payload: { provider: 'GITHUB', authType: 'OAUTH2', events: ['push', 'pull_request', 'issues'] },
  },
  {
    kind: 'INTEGRATION',
    slug: 'jira-integration',
    name: 'Jira',
    tagline: 'Two-way task and sprint synchronisation.',
    category: 'Dev Tools',
    tags: ['jira', 'atlassian', 'tasks'],
    publisherSlug: 'onetab-labs',
    payload: { provider: 'JIRA', authType: 'OAUTH2', events: ['issue_created', 'issue_updated'] },
  },
  {
    kind: 'INTEGRATION',
    slug: 'google-drive-integration',
    name: 'Google Drive',
    tagline: 'Embed files, preview docs, search attachments.',
    category: 'Storage',
    tags: ['google', 'drive', 'files'],
    publisherSlug: 'onetab-labs',
    payload: { provider: 'GOOGLE_DRIVE', authType: 'OAUTH2', events: ['file_shared'] },
  },
  {
    kind: 'INTEGRATION',
    slug: 'google-calendar-integration',
    name: 'Google Calendar',
    tagline: 'Auto-schedule meetings and mirror event reminders.',
    category: 'Calendar',
    tags: ['google', 'calendar', 'meetings'],
    publisherSlug: 'onetab-labs',
    payload: { provider: 'GOOGLE_CALENDAR', authType: 'OAUTH2', events: ['event_created'] },
  },
  {
    kind: 'INTEGRATION',
    slug: 'hubspot-integration',
    name: 'HubSpot',
    tagline: 'Pull deal context into the channel where it is discussed.',
    category: 'CRM',
    tags: ['crm', 'hubspot', 'sales'],
    publisherSlug: 'revenue-stack',
    pricingModel: 'PAID',
    priceCents: 1900,
    payload: { provider: 'HUBSPOT', authType: 'API_KEY', events: ['deal_stage_changed'] },
  },

  // --- Community Templates -------------------------------------------------
  {
    kind: 'TEMPLATE',
    slug: 'engineering-rfc',
    name: 'Engineering RFC',
    tagline: 'The design-doc format that actually gets read.',
    category: 'Docs',
    tags: ['rfc', 'design-doc', 'engineering'],
    publisherSlug: 'community',
    payload: {
      sections: ['Summary', 'Motivation', 'Design', 'Alternatives', 'Risks', 'Rollout'],
    },
  },
  {
    kind: 'TEMPLATE',
    slug: 'product-launch-plan',
    name: 'Product Launch Plan',
    tagline: 'Six-week launch board with owners and gates.',
    category: 'Projects',
    tags: ['launch', 'product', 'project-plan'],
    publisherSlug: 'community',
    payload: {
      board: ['Discovery', 'Build', 'Beta', 'GA Prep', 'Launched'],
      milestones: ['Beta sign-off', 'Docs complete', 'GA'],
    },
  },
  {
    kind: 'TEMPLATE',
    slug: 'weekly-1-1',
    name: 'Weekly 1:1',
    tagline: 'A running agenda that survives more than two weeks.',
    category: 'Meetings',
    tags: ['1-1', 'management', 'meetings'],
    publisherSlug: 'community',
    payload: {
      sections: ['Wins', 'Blockers', 'Feedback', 'Career', 'Action items'],
    },
  },
  {
    kind: 'TEMPLATE',
    slug: 'incident-postmortem',
    name: 'Incident Postmortem',
    tagline: 'Blameless postmortem with a timeline table.',
    category: 'Playbooks',
    tags: ['postmortem', 'sre', 'incidents'],
    publisherSlug: 'sentinel-io',
    payload: {
      sections: ['Impact', 'Timeline', 'Root cause', 'What went well', 'Action items'],
    },
  },
  {
    kind: 'TEMPLATE',
    slug: 'customer-onboarding-playbook',
    name: 'Customer Onboarding Playbook',
    tagline: 'Kickoff to first value, with the check-ins pre-scheduled.',
    category: 'Onboarding',
    tags: ['customer-success', 'onboarding', 'playbook'],
    publisherSlug: 'revenue-stack',
    payload: {
      phases: ['Kickoff', 'Configuration', 'Training', 'First value', '30-day review'],
    },
  },
];

/** Slugs promoted to the featured rail on the marketplace landing page. */
export const FEATURED_SLUGS = [
  'standup-summarizer',
  'midnight-slate',
  'support-triage-agent',
  'new-hire-onboarding',
  'command-bar',
  'github-integration',
];

/** Publishers whose listings carry the "official" badge. */
export const OFFICIAL_PUBLISHERS = ['onetab-labs'];
