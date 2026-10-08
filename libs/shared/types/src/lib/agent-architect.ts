/**
 * AI Agent Studio — prompt-to-agent ("Create with one prompt").
 *
 * The pipeline is: a person's request → {@link detectAgentRequirements}
 * (domain, apps, knowledge, approvals, team…) plus the planner's
 * `AgentBlueprint` (real tools, schedule, approvals) → an
 * {@link AgentArchitectSpec} — the structured intermediate the brief asks for,
 * shown to the person as a plan before anything is created — →
 * {@link specToStudioGraph}, the Studio canvas graph that
 * `compileStudioGraph` runs.
 *
 * Once an agent exists it is edited through {@link GraphEditOp}s: small,
 * checkable operations on the canvas graph ("insert an approval before these
 * steps", "set the schedule"). A request in plain words becomes ops (by rules
 * here, or by a model whose answer is sanitised against the same op schema),
 * ops are applied by {@link applyGraphEdits}, and {@link diffStudioGraphs}
 * reports what actually changed — computed, never claimed.
 *
 * Everything here is pure and shared: the API plans with it, the Studio
 * previews and applies with it.
 */
import {
  AGENT_GROUNDING_RULES,
  PLATFORM_TOOLS,
  appLabel,
  describeCronExpression,
  type AgentBlueprint,
  type AgentBlueprintStep,
  type AgentStepKind,
} from './agent-blueprint.js';
import { AGENT_DELEGATION_MODES, type AgentDelegationMode, type CanvasGraphEdge } from './studio-graph.js';
import { legacyToAutonomyLevel, type AgentAutonomy, type AutonomyLevel } from './agent-config.js';

/* ---------------------------------------------------------------- domain -- */

export type AgentDomain =
  | 'hr'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'support'
  | 'ecommerce'
  | 'banking'
  | 'insurance'
  | 'operations'
  | 'engineering'
  | 'legal'
  | 'education'
  | 'healthcare'
  | 'general';

export const AGENT_DOMAINS: Record<AgentDomain, { label: string; icon: string; keywords: readonly string[] }> = {
  hr: { label: 'HR', icon: 'Users', keywords: ['hr', 'resume', 'résumé', 'cv', 'candidate', 'recruit', 'hiring', 'interview', 'onboarding', 'employee', 'job description', 'payroll', 'leave request'] },
  sales: { label: 'Sales', icon: 'TrendingUp', keywords: ['sales', 'lead', 'prospect', 'deal', 'pipeline', 'crm', 'follow-up', 'follow up', 'quota', 'opportunit'] },
  marketing: { label: 'Marketing', icon: 'Megaphone', keywords: ['marketing', 'campaign', 'seo', 'social media', 'content calendar', 'newsletter', 'brand', 'ad spend', 'audience'] },
  finance: { label: 'Finance', icon: 'Wallet', keywords: ['finance', 'invoice', 'expense', 'accounting', 'accounts', 'reconcil', 'budget', 'revenue', 'ledger', 'payable', 'receivable'] },
  support: { label: 'Support', icon: 'LifeBuoy', keywords: ['support', 'ticket', 'helpdesk', 'help desk', 'customer issue', 'escalat', 'faq', 'complaint'] },
  ecommerce: { label: 'Ecommerce', icon: 'ShoppingCart', keywords: ['ecommerce', 'e-commerce', 'order', 'cart', 'refund', 'inventory', 'product catalog', 'shopify', 'checkout', 'shipment'] },
  banking: { label: 'Banking', icon: 'Landmark', keywords: ['bank', 'loan', 'kyc', 'transaction', 'account opening', 'credit card'] },
  insurance: { label: 'Insurance', icon: 'ShieldCheck', keywords: ['insurance', 'claim', 'policyholder', 'underwrit', 'premium'] },
  operations: { label: 'Operations', icon: 'Settings2', keywords: ['operations', 'ops', 'vendor', 'procurement', 'logistics', 'supply'] },
  engineering: { label: 'Engineering', icon: 'Code2', keywords: ['github', 'pull request', 'pr review', 'code review', 'deploy', 'incident', 'bug', 'repository', 'engineering', 'jira', 'linear'] },
  legal: { label: 'Legal', icon: 'Scale', keywords: ['legal', 'contract', 'nda', 'compliance', 'clause', 'agreement'] },
  education: { label: 'Education', icon: 'GraduationCap', keywords: ['student', 'course', 'lesson', 'teacher', 'curriculum', 'quiz', 'education'] },
  healthcare: { label: 'Healthcare', icon: 'HeartPulse', keywords: ['patient', 'clinic', 'appointment', 'medical', 'health', 'doctor'] },
  general: { label: 'General', icon: 'Sparkles', keywords: [] },
};

/* ------------------------------------------------------------------ apps -- */

export type ArchitectAppCategory = 'email' | 'chat' | 'crm' | 'ecommerce' | 'tickets' | 'calendar' | 'docs' | 'storage' | 'code' | 'project' | 'payments' | 'sheets';

export interface ArchitectApp {
  /** The integration provider key (`ExternalIntegration.provider`). */
  provider: string;
  label: string;
  category: ArchitectAppCategory;
  /** Words that name the app in a request (matched as whole words). */
  names: readonly string[];
}

/** Apps a request can name. The provider keys match the integration framework's. */
export const ARCHITECT_APPS: readonly ArchitectApp[] = [
  { provider: 'GMAIL', label: 'Gmail', category: 'email', names: ['gmail', 'google mail'] },
  { provider: 'OUTLOOK', label: 'Outlook', category: 'email', names: ['outlook'] },
  { provider: 'SLACK', label: 'Slack', category: 'chat', names: ['slack'] },
  { provider: 'MICROSOFT_TEAMS', label: 'Microsoft Teams', category: 'chat', names: ['microsoft teams', 'ms teams'] },
  { provider: 'SALESFORCE', label: 'Salesforce', category: 'crm', names: ['salesforce'] },
  { provider: 'HUBSPOT', label: 'HubSpot', category: 'crm', names: ['hubspot'] },
  { provider: 'SHOPIFY', label: 'Shopify', category: 'ecommerce', names: ['shopify'] },
  { provider: 'STRIPE', label: 'Stripe', category: 'payments', names: ['stripe'] },
  { provider: 'ZENDESK', label: 'Zendesk', category: 'tickets', names: ['zendesk'] },
  { provider: 'JIRA', label: 'Jira', category: 'project', names: ['jira'] },
  { provider: 'LINEAR', label: 'Linear', category: 'project', names: ['linear'] },
  { provider: 'TRELLO', label: 'Trello', category: 'project', names: ['trello'] },
  { provider: 'NOTION', label: 'Notion', category: 'docs', names: ['notion'] },
  { provider: 'GITHUB', label: 'GitHub', category: 'code', names: ['github'] },
  { provider: 'GOOGLE_CALENDAR', label: 'Google Calendar', category: 'calendar', names: ['google calendar', 'gcal'] },
  { provider: 'GOOGLE_DRIVE', label: 'Google Drive', category: 'storage', names: ['google drive', 'gdrive'] },
  { provider: 'GOOGLE_SHEETS', label: 'Google Sheets', category: 'sheets', names: ['google sheets', 'google sheet', 'spreadsheet'] },
  { provider: 'GOOGLE_DOCS', label: 'Google Docs', category: 'docs', names: ['google docs', 'google doc'] },
];

/** Categories a request can need without naming an app, and which apps would do. */
const CATEGORY_WORDS: Array<{ category: ArchitectAppCategory; words: RegExp; title: string; options: string[] }> = [
  { category: 'crm', words: /\b(crm|leads?|deals?|pipeline|prospects?)\b/, title: 'Sales / CRM data', options: ['Salesforce', 'HubSpot', 'Upload a CSV'] },
  { category: 'email', words: /\b(e-?mails?|inbox|mailbox)\b/, title: 'Email account', options: ['Gmail', 'Outlook'] },
  { category: 'tickets', words: /\b(tickets?|helpdesk|help desk)\b/, title: 'Ticket source', options: ['Zendesk', 'Jira', 'Workspace tasks'] },
  { category: 'ecommerce', words: /\b(orders?|abandoned carts?|carts?|refunds?|inventory|store)\b/, title: 'Store data', options: ['Shopify', 'Stripe'] },
];

/* --------------------------------------------------------- requirements -- */

export type ArchitectTriggerKind = 'manual' | 'schedule' | 'event' | 'webhook' | 'email' | 'chat' | 'form';

/** What a request needs, read from its words alone. Deterministic; the planner adds the rest. */
export interface DetectedRequirements {
  domain: AgentDomain;
  /** Apps the request names. `role` is how the agent uses them. */
  apps: Array<{ provider: string; label: string; role: 'input' | 'output' | 'both' }>;
  /** Kinds of data source it needs without naming one ("CRM", "tickets"). */
  categories: Array<{ category: ArchitectAppCategory; title: string; options: string[] }>;
  triggerHint: ArchitectTriggerKind;
  /** Whether the request names a time ("every Monday", "daily"). */
  mentionsSchedule: boolean;
  wantsKnowledge: boolean;
  wantsMemory: boolean;
  wantsApproval: boolean;
  /** It sends, posts or changes something other people see. */
  actsOutward: boolean;
  wantsRetry: boolean;
  wantsMultiAgent: boolean;
  /** Specialist roles a multi-agent request lists ("orders, refunds, support and inventory"). */
  specialists: string[];
  inputs: string[];
  outputs: string[];
}

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9#@'’\- ]+/g, ' ').replace(/\s+/g, ' ')} `;

const OUTPUT_VERBS = /\b(send|sends|sending|post|posts|posting|notify|notifies|email (me|them|the)|message|reply|replies|publish|share|alert|follow[- ]ups?|draft)\b/;

export function detectAgentRequirements(prompt: string): DetectedRequirements {
  const text = prompt.toLowerCase();
  const padded = words(prompt);

  // Domain: the one whose keywords the request uses most.
  let domain: AgentDomain = 'general';
  let best = 0;
  for (const [key, info] of Object.entries(AGENT_DOMAINS) as Array<[AgentDomain, (typeof AGENT_DOMAINS)[AgentDomain]]>) {
    const score = info.keywords.reduce((n, k) => n + (text.includes(k) ? (k.length > 5 ? 2 : 1) : 0), 0);
    if (score > best) {
      best = score;
      domain = key;
    }
  }

  const apps: DetectedRequirements['apps'] = [];
  for (const app of ARCHITECT_APPS) {
    const at = app.names.map((n) => padded.indexOf(` ${n}`)).filter((i) => i >= 0);
    if (!at.length) continue;
    // "…and send the summary to Slack" — an app named after a sending verb is where results go.
    const before = padded.slice(Math.max(0, Math.min(...at) - 60), Math.min(...at));
    const after = padded.slice(Math.min(...at), Math.min(...at) + 40);
    const outputish = /\b(to|in|into|via|through|on)\s+$/.test(before) || OUTPUT_VERBS.test(before.split(/\b(and|then)\b/).pop() ?? '');
    const inputish = /\b(from|my|our|check|checks|read|reads|monitor|monitors|watch|watches|in my)\b/.test(before.slice(-25)) || /^\s*\S+\s+(inbox|leads?|tickets?|issues?|orders?)/.test(after);
    apps.push({ provider: app.provider, label: app.label, role: outputish && inputish ? 'both' : outputish ? 'output' : 'input' });
  }

  const categories: DetectedRequirements['categories'] = [];
  for (const c of CATEGORY_WORDS) {
    if (!c.words.test(text)) continue;
    if (apps.some((a) => ARCHITECT_APPS.find((x) => x.provider === a.provider)?.category === c.category)) continue;
    // "email me the report" is a delivery, not an inbox to read.
    if (c.category === 'email' && !/\b(inbox|incoming e-?mails?|my e-?mails?|unread|e-?mails? (arrive|come in))\b/.test(text)) continue;
    categories.push({ category: c.category, title: c.title, options: c.options });
  }

  const mentionsSchedule =
    /\b(every|each|daily|weekly|monthly|hourly|nightly|morning|evening|weekday|weekdays|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b/.test(text);
  const triggerHint: ArchitectTriggerKind = mentionsSchedule
    ? 'schedule'
    : /\b(webhook)\b/.test(text)
      ? 'webhook'
      : /\b(when|whenever|as soon as|incoming|new (lead|ticket|email|order|message|form|file|record)s?|arrives?|is (created|submitted|uploaded))\b/.test(text)
        ? /\b(incoming e-?mail|e-?mails? arrive|new e-?mail|inbox)\b/.test(text)
          ? 'email'
          : /\bform\b/.test(text)
            ? 'form'
            : 'event'
        : /\b(chat|ask (it|the agent)|answers? questions)\b/.test(text)
          ? 'chat'
          : 'manual';

  const wantsKnowledge =
    /\b(knowledge( base)?|documentation|our docs|company (docs|documents|policies|handbook)|policy docs|faq|handbook|playbook|job description|product (docs|info|information)|rag)\b/.test(text);
  const wantsMemory = /\b(remember|memory|history|past (conversations|interactions)|previous (runs|interactions)|customer history)\b/.test(text);
  const actsOutward = OUTPUT_VERBS.test(text) || apps.some((a) => a.role !== 'input');
  const wantsApproval = /\b(approv\w*|review (it |them )?before|sign[- ]off|human in the loop|check with me|confirm before)\b/.test(text);
  const wantsRetry = /\b(retry|retries|fail(ure|ures|s|ing)?|robust|resilient|fallback)\b/.test(text);

  // "orders, refunds, customer support and inventory" → four specialists.
  let specialists: string[] = [];
  const list = text.match(/handles?\s+([a-z ,/&-]+?(?:,| and)[a-z ,/&-]+?)(?:[.;]|$| for | with )/);
  if (list?.[1]) {
    specialists = list[1]
      .split(/,|\band\b|&|\//)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 40)
      .slice(0, 6);
  }
  const wantsMultiAgent = /\b(multi[- ]?agent|team of agents|orchestrat\w*|specialist agents|several agents|multiple agents|sub[- ]?agents)\b/.test(text) || specialists.length >= 3;

  const inputs: string[] = [];
  const add = (list: string[], v: string) => !list.includes(v) && list.push(v);
  if (/\b(e-?mails?|inbox)\b/.test(text) && (apps.some((a) => a.provider === 'GMAIL' && a.role !== 'output') || categories.some((c) => c.category === 'email'))) add(inputs, 'Email');
  if (/\b(resumes?|cvs?|documents?|pdfs?|files?|attachments?)\b/.test(text)) add(inputs, 'Documents');
  if (/\b(crm|leads?|deals?|prospects?)\b/.test(text)) add(inputs, 'CRM records');
  if (/\b(tickets?)\b/.test(text)) add(inputs, 'Tickets');
  if (/\b(orders?|carts?|inventory)\b/.test(text)) add(inputs, 'Store records');
  if (/\b(forms?|submissions?)\b/.test(text)) add(inputs, 'Forms');
  if (/\b(calendar|meetings?|events?)\b/.test(text)) add(inputs, 'Calendar events');
  if (/\b(tasks?|projects?)\b/.test(text)) add(inputs, 'Workspace tasks');
  if (/\b(slack messages|messages in|channel)\b/.test(text)) add(inputs, 'Messages');
  if (wantsKnowledge) add(inputs, 'Knowledge');

  const outputs: string[] = [];
  if (/\b(report|summary|summari[sz]e|digest|brief)\b/.test(text)) add(outputs, 'Report');
  if (/\b(e-?mail (me|them|the)|send .*e-?mails?|follow[- ]ups?|reply|replies|draft)\b/.test(text)) add(outputs, 'Email');
  if (/\b(create|creates|add) (a )?(tasks?|to-?dos?)\b/.test(text) || /\bshortlist\b/.test(text)) add(outputs, /\bshortlist\b/.test(text) ? 'Shortlist' : 'Task');
  if (/\b(update|updates) (the )?crm\b/.test(text)) add(outputs, 'CRM update');
  if (/\b(notify|notification|alert)\b/.test(text) || apps.some((a) => ['SLACK', 'MICROSOFT_TEAMS'].includes(a.provider) && a.role !== 'input')) add(outputs, 'Notification');
  if (/\b(doc|document)\b/.test(text) && /\b(write|create|save)\b/.test(text)) add(outputs, 'Document');
  if (/\b(rank|ranks|score|scores|qualif\w+)\b/.test(text)) add(outputs, 'Ranking');
  if (!outputs.length) add(outputs, 'Answer');

  return {
    domain,
    apps,
    categories,
    triggerHint,
    mentionsSchedule,
    wantsKnowledge,
    wantsMemory,
    wantsApproval,
    actsOutward,
    wantsRetry,
    wantsMultiAgent,
    specialists,
    inputs,
    outputs,
  };
}

/* ------------------------------------------------------------------ spec -- */

export type ArchitectStepKind = AgentStepKind | 'knowledge';

export interface ArchitectStep {
  id: string;
  kind: ArchitectStepKind;
  title: string;
  why?: string;
  /** A built-in tool or `PROVIDER.action`. */
  tool?: string;
  /** The app this step needs when no tool is picked yet (it isn't connected). */
  app?: string;
  input?: Record<string, unknown>;
  prompt?: string;
  condition?: string;
  requiresApproval?: boolean;
  retries?: number;
  onFailure?: 'retry' | 'continue' | 'stop';
}

export interface ArchitectAppRequirement {
  provider: string;
  label: string;
  connected: boolean;
  purpose: string;
}

export type MissingConfigKind = 'connection' | 'data_source' | 'knowledge' | 'channel' | 'schedule' | 'param' | 'delivery';

/** Something the agent can't run without — asked for progressively, never as a wall of questions. */
export interface MissingConfigItem {
  id: string;
  kind: MissingConfigKind;
  title: string;
  detail: string;
  /** Ways to satisfy it, in the person's words ("Connect Salesforce", "Upload a CSV"). */
  options: string[];
  provider?: string;
  /** Blocks a live run. Optional items only improve the agent. */
  required: boolean;
}

export type RecommendationKind =
  | 'knowledge'
  | 'approval'
  | 'memory'
  | 'retry'
  | 'failure_alerts'
  | 'multi_agent'
  | 'escalation'
  | 'schedule';

export interface ArchitectRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  reason: string;
  /** Included unless the person turns it off. */
  recommended: boolean;
}

export interface ArchitectTeamMember {
  key: string;
  name: string;
  role: string;
  instructions: string;
}

/** The structured intermediate between a request and a workflow (brief §33). */
export interface AgentArchitectSpec {
  version: 1;
  goal: string;
  domain: AgentDomain;
  agent: {
    name: string;
    description: string;
    icon: string;
    category: string;
    tags: string[];
    instructions: string;
    /** Unset: the agent uses the workspace's default model. */
    model?: string;
    temperature: number;
  };
  trigger: { kind: ArchitectTriggerKind; cron?: string; timezone?: string; event?: string; label: string };
  inputs: string[];
  outputs: string[];
  steps: ArchitectStep[];
  tools: string[];
  apps: ArchitectAppRequirement[];
  knowledge: { enabled: boolean; knowledgeBaseId?: string; name?: string; reason?: string };
  memory: { enabled: boolean; scope: 'private' | 'shared'; reason?: string };
  /** Step ids that wait for a person. */
  approvals: string[];
  permissions: string[];
  errorHandling: { retries: number; notifyOnFailure: boolean };
  team?: { mode: AgentDelegationMode; members: ArchitectTeamMember[] };
  missingConfiguration: MissingConfigItem[];
  recommendations: ArchitectRecommendation[];
  assumptions: string[];
  warnings: string[];
  source: { kind: 'ai' | 'template'; prompt: string; model?: string; fallbackReason?: string };
}

export interface ArchitectContext {
  /** Providers with a CONNECTED integration the requester may use. */
  connectedApps: readonly string[];
  /** Actions of connected apps (`GMAIL.send_email`), by provider. */
  appActions?: Readonly<Record<string, ReadonlyArray<{ tool: string; label: string; access: 'read' | 'write' | 'destructive' }>>>;
  knowledgeBases: ReadonlyArray<{ id: string; name: string }>;
  timezone?: string;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'step';

function uniqueId(base: string, taken: Set<string>): string {
  let id = slug(base);
  for (let n = 2; taken.has(id); n++) id = `${slug(base)}_${n}`;
  taken.add(id);
  return id;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Picks a connected app's action for a purpose: reading data in, or sending results out. */
function pickAppAction(ctx: ArchitectContext, provider: string, purpose: 'input' | 'output') {
  const actions = ctx.appActions?.[provider] ?? [];
  if (purpose === 'input') {
    return actions.find((a) => a.access === 'read' && /list|search|get|find|fetch|read/i.test(a.tool)) ?? actions.find((a) => a.access === 'read');
  }
  return (
    actions.find((a) => a.access !== 'read' && /send|post|message|create|reply|draft/i.test(a.tool)) ?? actions.find((a) => a.access !== 'read')
  );
}

function describeTrigger(trigger: AgentArchitectSpec['trigger']): string {
  switch (trigger.kind) {
    case 'schedule':
      return describeCronExpression(trigger.cron);
    case 'event':
      return trigger.event ? `When ${trigger.event.replace('.', ' is ').replace(/_/g, ' ')}` : 'When something happens';
    case 'webhook':
      return 'When a webhook is received';
    case 'email':
      return 'When an email arrives';
    case 'chat':
      return 'When someone messages it';
    case 'form':
      return 'When a form is submitted';
    default:
      return 'When you run it';
  }
}

const OUTWARD_TOOL = /send|post|publish|reply|message|notify|email|create_draft/i;

/** Whether a step reaches other people (and so is worth an approval). */
function isOutwardStep(step: ArchitectStep): boolean {
  if (step.kind !== 'action' && step.kind !== 'notify') return false;
  if (step.tool && PLATFORM_TOOLS[step.tool]) return !!PLATFORM_TOOLS[step.tool]!.approvalByDefault || /send|post/.test(step.tool);
  return OUTWARD_TOOL.test(step.tool ?? step.title) || !!step.app;
}

/**
 * Builds the spec from the planner's blueprint and what the request's words
 * need. Adds what the plan left out but the request asked for (an app the
 * planner couldn't use because it isn't connected, knowledge, approvals), and
 * lists — honestly — what is still missing before it can run.
 */
export function buildArchitectSpec(bp: AgentBlueprint, req: DetectedRequirements, ctx: ArchitectContext, prompt: string): AgentArchitectSpec {
  const taken = new Set<string>(bp.steps.map((s) => s.id));
  const connected = new Set(ctx.connectedApps.map((p) => p.toUpperCase()));
  const steps: ArchitectStep[] = bp.steps.map((s: AgentBlueprintStep) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    ...(s.why ? { why: s.why } : {}),
    ...(s.tool ? { tool: s.tool } : {}),
    ...(s.input ? { input: s.input } : {}),
    ...(s.prompt ? { prompt: s.prompt } : {}),
    ...(s.condition ? { condition: s.condition } : {}),
    ...(s.requiresApproval ? { requiresApproval: true } : {}),
    ...(s.retries !== undefined ? { retries: s.retries } : {}),
    ...(s.onFailure ? { onFailure: s.onFailure } : {}),
  }));
  const warnings = [...bp.warnings];
  const assumptions = [...bp.assumptions];
  const missing: MissingConfigItem[] = [];

  // A step the planner pointed at the workspace's own channels, but whose
  // title names the outside app the request asked for ("Post summary to
  // Slack"), is that app's step — not a second one beside it.
  const retargeted = new Set<string>();
  for (const app of req.apps) {
    if (app.role === 'input' || !['chat', 'email'].includes(ARCHITECT_APPS.find((a) => a.provider === app.provider)?.category ?? '')) continue;
    const step = steps.find((s) => (s.kind === 'action' || s.kind === 'notify') && (s.tool === 'send_channel_message' || s.tool === 'notify_user') && s.title.toLowerCase().includes(app.label.toLowerCase()));
    if (!step) continue;
    const picked = connected.has(app.provider) ? pickAppAction(ctx, app.provider, 'output') : undefined;
    delete step.tool;
    if (picked) step.tool = picked.tool;
    else step.app = app.provider;
    retargeted.add(step.id);
  }

  // Apps the request names that no step uses yet.
  const usesApp = (provider: string) => steps.some((s) => s.app === provider || s.tool?.toUpperCase().startsWith(`${provider}.`) || (provider === 'GMAIL' && s.tool === 'search_email'));
  for (const app of req.apps) {
    if (usesApp(app.provider)) continue;
    const roles: Array<'input' | 'output'> = app.role === 'both' ? ['input', 'output'] : [app.role];
    for (const role of roles) {
      const picked = connected.has(app.provider) ? pickAppAction(ctx, app.provider, role) : undefined;
      const step: ArchitectStep =
        role === 'input'
          ? { id: uniqueId(`read_${app.label}`, taken), kind: 'collect', title: `Read from ${app.label}`, why: `The request works from ${app.label}.`, ...(picked ? { tool: picked.tool, input: {} } : { app: app.provider }) }
          : { id: uniqueId(`send_${app.label}`, taken), kind: 'action', title: `Send via ${app.label}`, why: `The request delivers through ${app.label}.`, ...(picked ? { tool: picked.tool, input: {} } : { app: app.provider }) };
      if (role === 'input') {
        const firstNonCollect = steps.findIndex((s) => s.kind !== 'collect');
        steps.splice(firstNonCollect < 0 ? steps.length : firstNonCollect, 0, step);
      } else {
        steps.push(step);
      }
    }
  }

  // Knowledge: retrieved before the first writing step.
  let knowledge: AgentArchitectSpec['knowledge'] = { enabled: false };
  if (req.wantsKnowledge) {
    const named = ctx.knowledgeBases.find((kb) => prompt.toLowerCase().includes(kb.name.toLowerCase()));
    const kb = named ?? (ctx.knowledgeBases.length === 1 ? ctx.knowledgeBases[0] : undefined);
    knowledge = { enabled: true, ...(kb ? { knowledgeBaseId: kb.id, name: kb.name } : {}), reason: 'The request works from your own documents.' };
    if (!steps.some((s) => s.kind === 'knowledge')) {
      const at = steps.findIndex((s) => s.kind === 'analyze' || s.kind === 'generate');
      steps.splice(at < 0 ? steps.length : at, 0, {
        id: uniqueId('search_knowledge', taken),
        kind: 'knowledge',
        title: kb ? `Search ${kb.name}` : 'Search company knowledge',
        why: 'Answers come from your documents, with sources.',
      });
    }
    if (!kb) {
      // When the plan already searches the workspace's docs, uploaded knowledge only adds to it.
      const searchesDocs = steps.some((s) => s.tool === 'search_docs' || s.tool === 'read_doc');
      missing.push({
        id: 'knowledge',
        kind: 'knowledge',
        title: 'Company knowledge',
        detail: searchesDocs
          ? 'It already searches your workspace docs. Add a knowledge base for uploaded files and URLs too, or skip this.'
          : ctx.knowledgeBases.length
            ? 'Pick which knowledge base it should search.'
            : 'Upload the documents it should use, or connect a source.',
        options: ctx.knowledgeBases.length ? ctx.knowledgeBases.slice(0, 4).map((k) => k.name) : ['Upload files', 'Add a URL'],
        required: !searchesDocs,
      });
    }
  }

  // Approval before anything that reaches other people, when asked for.
  if (req.wantsApproval) {
    let gated = false;
    for (const s of steps) {
      if (isOutwardStep(s)) {
        s.requiresApproval = true;
        gated = true;
      }
    }
    if (!gated && !steps.some((s) => s.kind === 'approval')) {
      steps.push({ id: uniqueId('approve', taken), kind: 'approval', title: 'Ask for approval', why: 'You asked to check the result first.' });
    }
  }

  // Retry policy: reads and writing retry; actions only when asked (a retried write could happen twice).
  const retries = req.wantsRetry ? 3 : 1;
  for (const s of steps) {
    if (s.retries === undefined && (s.kind === 'collect' || s.kind === 'knowledge' || s.kind === 'analyze' || s.kind === 'generate')) s.retries = retries;
    if (req.wantsRetry && s.retries === undefined && (s.kind === 'action' || s.kind === 'notify')) s.retries = 2;
  }

  // Apps: needed, and whether they're connected.
  const appReqs = new Map<string, ArchitectAppRequirement>();
  for (const s of steps) {
    const provider = s.app ?? (s.tool && s.tool.includes('.') ? s.tool.slice(0, s.tool.indexOf('.')).toUpperCase() : s.tool === 'search_email' ? 'GMAIL' : undefined);
    if (!provider || appReqs.has(provider)) continue;
    appReqs.set(provider, {
      provider,
      label: ARCHITECT_APPS.find((a) => a.provider === provider)?.label ?? appLabel(provider),
      connected: connected.has(provider),
      purpose: s.title,
    });
  }
  for (const app of appReqs.values()) {
    if (app.connected) continue;
    missing.push({
      id: `connect_${app.provider.toLowerCase()}`,
      kind: 'connection',
      title: `Connect ${app.label}`,
      detail: `Needed for “${app.purpose}”.`,
      options: [`Connect ${app.label}`],
      provider: app.provider,
      required: true,
    });
  }
  for (const c of req.categories) {
    if ([...appReqs.values()].some((a) => ARCHITECT_APPS.find((x) => x.provider === a.provider)?.category === c.category)) continue;
    // Workspace tasks already cover "tickets" when the plan reads tasks.
    if (c.category === 'tickets' && steps.some((s) => s.tool === 'find_tasks' || s.tool === 'list_tasks')) continue;
    missing.push({
      id: `source_${c.category}`,
      kind: 'data_source',
      title: c.title,
      detail: 'Where should it get this from?',
      options: c.options,
      required: true,
    });
  }

  // Two approvals in a row ask the same person the same thing once too often.
  steps.forEach((step, i) => {
    if (step.requiresApproval && steps[i - 1]?.kind === 'approval') delete step.requiresApproval;
  });

  // Questions the planner couldn't answer itself. "Which channel should it
  // post to?" is moot once posting goes to an outside app.
  for (const q of bp.questions) {
    if (retargeted.size && q.field === 'output.channelSlug') continue;
    missing.push({
      id: q.id,
      kind: q.field?.includes('channel') || q.paramKey?.toLowerCase().includes('channel') ? 'channel' : 'param',
      title: q.question,
      detail: 'Choose it before switching the agent on.',
      options: [],
      required: true,
    });
  }

  const trigger: AgentArchitectSpec['trigger'] = (() => {
    if (bp.trigger.kind === 'schedule') return { kind: 'schedule' as const, ...(bp.trigger.cron ? { cron: bp.trigger.cron } : {}), timezone: bp.trigger.timezone ?? ctx.timezone ?? 'UTC', label: '' };
    if (bp.trigger.kind === 'event') return { kind: 'event' as const, ...(bp.trigger.event ? { event: bp.trigger.event } : {}), label: '' };
    if (req.triggerHint === 'email' || req.triggerHint === 'webhook' || req.triggerHint === 'form' || req.triggerHint === 'chat') return { kind: req.triggerHint, label: '' };
    return { kind: 'manual' as const, label: '' };
  })();
  trigger.label = describeTrigger(trigger);
  if (trigger.kind === 'schedule' && !trigger.cron) {
    missing.push({ id: 'schedule', kind: 'schedule', title: 'Schedule', detail: 'When should it run?', options: ['Every weekday at 9:00', 'Every Monday at 9:00', 'Daily at 18:00'], required: true });
  }
  if (req.mentionsSchedule && trigger.kind !== 'schedule') {
    assumptions.push('The request mentions a time, but it couldn’t be read as a schedule — set one under the trigger.');
  }
  if (trigger.kind === 'email' || trigger.kind === 'webhook' || trigger.kind === 'form') {
    warnings.push(`${titleCase(trigger.kind)} triggers aren’t connected to the runtime yet, so for now it runs when you start it (or on a schedule).`);
  }

  // Team: a coordinator with specialists when the work splits cleanly.
  let team: AgentArchitectSpec['team'];
  if (req.wantsMultiAgent) {
    const roles = req.specialists.length >= 2 ? req.specialists : steps.filter((s) => s.kind === 'analyze' || s.kind === 'generate').map((s) => s.title);
    if (roles.length >= 2) {
      team = {
        mode: 'router',
        members: roles.slice(0, 6).map((role) => ({
          key: slug(`${role}_agent`),
          name: `${titleCase(role.replace(/\bagent\b/i, '').trim())} Agent`,
          role: titleCase(role),
          instructions: `You handle ${role}. Do only your part, using the data you are given, and report back clearly.`,
        })),
      };
    }
  }

  // Recommendations: useful additions, contextual — never everything at once.
  const recommendations: ArchitectRecommendation[] = [];
  const recommend = (r: ArchitectRecommendation) => !recommendations.some((x) => x.kind === r.kind) && recommendations.push(r);
  const outward = steps.some(isOutwardStep);
  if (outward && !req.wantsApproval && !steps.some((s) => s.kind === 'approval' || s.requiresApproval)) {
    recommend({ id: 'rec_approval', kind: 'approval', title: 'Human approval before sending', reason: 'It sends things other people see. You check them first.', recommended: req.domain !== 'general' });
  }
  if (!knowledge.enabled && ['support', 'hr', 'sales', 'legal', 'insurance', 'banking'].includes(req.domain)) {
    recommend({ id: 'rec_knowledge', kind: 'knowledge', title: 'Company knowledge base', reason: `${AGENT_DOMAINS[req.domain].label} answers are better grounded in your own documents.`, recommended: req.domain === 'support' });
  }
  if (req.domain === 'support') {
    recommend({ id: 'rec_escalation', kind: 'escalation', title: 'Human escalation', reason: 'Urgent or unclear tickets go to a person instead of an automatic reply.', recommended: true });
  }
  if (trigger.kind !== 'manual') {
    recommend({ id: 'rec_failure_alerts', kind: 'failure_alerts', title: 'Tell me when a run fails', reason: 'It runs unattended, so failures should reach you.', recommended: true });
  }
  if (!req.wantsRetry && steps.some((s) => s.kind === 'collect' && (s.app || s.tool?.includes('.')))) {
    recommend({ id: 'rec_retry', kind: 'retry', title: 'Retry failed app calls (3 times)', reason: 'Outside apps sometimes fail for a moment.', recommended: true });
  }
  if (!req.wantsMemory && (bp.kind === 'assistant' || req.domain === 'support' || req.domain === 'sales')) {
    recommend({ id: 'rec_memory', kind: 'memory', title: 'Long-term memory', reason: 'It remembers past customers and decisions between runs.', recommended: false });
  }
  if (!team && steps.filter((s) => s.kind === 'analyze' || s.kind === 'generate').length >= 3) {
    recommend({ id: 'rec_team', kind: 'multi_agent', title: 'Split into specialist agents', reason: 'Several distinct jobs — a coordinator with specialists keeps each focused.', recommended: false });
  }
  if (req.mentionsSchedule === false && trigger.kind === 'manual' && /\b(report|digest|summary|check)\b/i.test(prompt)) {
    recommend({ id: 'rec_schedule', kind: 'schedule', title: 'Run it on a schedule', reason: 'Reports are most useful when they arrive on their own.', recommended: false });
  }

  const tools = [...new Set(steps.map((s) => s.tool).filter((t): t is string => !!t))];
  const domainInfo = AGENT_DOMAINS[req.domain];
  // A plan that fell back to a template carries the template's name and aim;
  // the agent is still what the person asked for.
  const fellBack = bp.source.kind !== 'ai' && !!bp.source.fallbackReason;
  const name = fellBack ? `${req.domain === 'general' ? 'Workspace' : domainInfo.label} ${team ? 'operations team' : 'agent'}` : bp.name;
  return {
    version: 1,
    goal: fellBack ? prompt.slice(0, 300) : bp.objective || prompt.slice(0, 300),
    domain: req.domain,
    agent: {
      name,
      description: fellBack ? prompt.slice(0, 300) : bp.objective,
      icon: domainInfo.icon,
      category: domainInfo.label,
      tags: [domainInfo.label, ...req.apps.map((a) => a.label)].slice(0, 6),
      instructions: [
        bp.instructions?.trim() || `You are ${name}. ${fellBack ? prompt.slice(0, 300) : bp.objective}`.trim(),
        'Be concise and factual. Say plainly when you lack the data to do something.',
      ].join('\n'),
      temperature: 0.3,
    },
    trigger,
    inputs: req.inputs,
    outputs: req.outputs,
    steps,
    tools,
    apps: [...appReqs.values()],
    knowledge,
    memory: { enabled: req.wantsMemory, scope: 'private', ...(req.wantsMemory ? { reason: 'The request asks it to remember.' } : {}) },
    approvals: steps.filter((s) => s.kind === 'approval' || s.requiresApproval).map((s) => s.id),
    permissions: bp.scopes,
    errorHandling: { retries, notifyOnFailure: trigger.kind !== 'manual' },
    ...(team ? { team } : {}),
    missingConfiguration: missing,
    recommendations,
    assumptions: [...new Set(assumptions)].slice(0, 10),
    warnings: [...new Set(warnings)].slice(0, 10),
    source: {
      kind: bp.source.kind === 'ai' ? 'ai' : 'template',
      prompt: prompt.slice(0, 4_000),
      ...(bp.source.model ? { model: bp.source.model } : {}),
      ...(bp.source.fallbackReason ? { fallbackReason: bp.source.fallbackReason } : {}),
    },
  };
}

/**
 * Folds the person's choices into a spec before it is built: recommendations
 * they kept, and the plan otherwise unchanged.
 */
export function applyRecommendations(spec: AgentArchitectSpec, acceptedIds: readonly string[]): AgentArchitectSpec {
  const next: AgentArchitectSpec = structuredClone(spec);
  const taken = new Set(next.steps.map((s) => s.id));
  for (const rec of next.recommendations) {
    if (!acceptedIds.includes(rec.id)) continue;
    switch (rec.kind) {
      case 'approval':
      case 'escalation': {
        let gated = false;
        for (const s of next.steps) {
          if (isOutwardStep(s)) {
            s.requiresApproval = true;
            gated = true;
          }
        }
        if (!gated && !next.steps.some((s) => s.kind === 'approval')) {
          next.steps.push({ id: uniqueId(rec.kind === 'escalation' ? 'escalate' : 'approve', taken), kind: 'approval', title: rec.kind === 'escalation' ? 'Escalate to a person' : 'Ask for approval' });
        }
        break;
      }
      case 'knowledge':
        if (!next.knowledge.enabled) {
          next.knowledge = { enabled: true, reason: rec.reason };
          const at = next.steps.findIndex((s) => s.kind === 'analyze' || s.kind === 'generate');
          next.steps.splice(at < 0 ? next.steps.length : at, 0, { id: uniqueId('search_knowledge', taken), kind: 'knowledge', title: 'Search company knowledge' });
          if (!next.missingConfiguration.some((m) => m.kind === 'knowledge')) {
            next.missingConfiguration.push({ id: 'knowledge', kind: 'knowledge', title: 'Company knowledge', detail: 'Pick or upload the documents it should search.', options: ['Upload files', 'Add a URL'], required: true });
          }
        }
        break;
      case 'retry':
        next.errorHandling.retries = 3;
        for (const s of next.steps) if (s.kind === 'collect' || s.kind === 'knowledge') s.retries = 3;
        break;
      case 'failure_alerts':
        next.errorHandling.notifyOnFailure = true;
        break;
      case 'memory':
        next.memory = { enabled: true, scope: 'private', reason: rec.reason };
        break;
      case 'multi_agent': {
        const roles = next.steps.filter((s) => s.kind === 'analyze' || s.kind === 'generate');
        if (roles.length >= 2) {
          next.team = { mode: 'sequential', members: roles.map((s) => ({ key: slug(`${s.id}_agent`), name: `${titleCase(s.title)} Agent`, role: s.title, instructions: s.prompt ?? `Do this: ${s.title}.` })) };
        }
        break;
      }
      case 'schedule':
        if (next.trigger.kind === 'manual') {
          next.trigger = { kind: 'schedule', cron: '0 9 * * 1-5', timezone: next.trigger.timezone ?? 'UTC', label: '' };
          next.trigger.label = describeTrigger(next.trigger);
        }
        break;
    }
  }
  next.approvals = next.steps.filter((s) => s.kind === 'approval' || s.requiresApproval).map((s) => s.id);
  next.recommendations = next.recommendations.filter((r) => !acceptedIds.includes(r.id));
  return next;
}

/**
 * Re-reads which apps are connected (after the person connected one) without
 * planning again: steps waiting on an app that is now connected get its
 * action, and the missing list drops what is satisfied.
 */
export function refreshSpecConnections(spec: AgentArchitectSpec, ctx: ArchitectContext): AgentArchitectSpec {
  const next: AgentArchitectSpec = structuredClone(spec);
  const connected = new Set(ctx.connectedApps.map((p) => p.toUpperCase()));
  for (const s of next.steps) {
    if (!s.app || s.tool || !connected.has(s.app)) continue;
    const picked = pickAppAction(ctx, s.app, s.kind === 'collect' ? 'input' : 'output');
    if (picked) {
      s.tool = picked.tool;
      s.input = s.input ?? {};
      delete s.app;
    }
  }
  next.apps = next.apps.map((a) => ({ ...a, connected: connected.has(a.provider) }));
  next.missingConfiguration = next.missingConfiguration
    .filter((m) => !(m.kind === 'connection' && m.provider && connected.has(m.provider) && !next.steps.some((s) => s.app === m.provider)))
    .map((m) =>
      m.kind === 'connection' && m.provider && connected.has(m.provider)
        ? { ...m, title: `Pick the ${next.apps.find((a) => a.provider === m.provider)?.label ?? m.provider} action`, detail: 'It’s connected, but has no action that fits — pick one on the step.' }
        : m,
    );
  next.tools = [...new Set(next.steps.map((s) => s.tool).filter((t): t is string => !!t))];
  return next;
}

/* ----------------------------------------------------------------- graph -- */

/** A canvas node as `apps/ai-agent-studio` stores it. */
export interface StudioCanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; subtitle?: string; config: Record<string, unknown>; [key: string]: unknown };
}

export interface StudioCanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  animated?: boolean;
  label?: string;
}

export interface StudioCanvasGraph {
  nodes: StudioCanvasNode[];
  edges: StudioCanvasEdge[];
  settings?: Record<string, unknown>;
}

const X_GAP = 300;
const Y_MAIN = 200;

/** The context key a canvas step's result lands under, for `{{id.key}}` references. */
export function canvasResultKey(type: string): string {
  switch (type) {
    case 'AGENT':
    case 'SUB_AGENT':
    case 'AGENT_COORDINATOR':
      return 'entityResponse';
    case 'KB_SEARCH':
    case 'VECTOR_SEARCH':
    case 'KNOWLEDGE_RETRIEVAL':
      return 'retrievedDocuments';
    case 'AI_CHAT_MODEL':
    case 'LLM':
    case 'AI_SUMMARIZER':
      return 'aiOutput';
    default:
      return 'toolResult';
  }
}

function triggerNodeType(kind: ArchitectTriggerKind): string {
  return {
    manual: 'TRIGGER_MANUAL',
    schedule: 'TRIGGER_SCHEDULE',
    event: 'TRIGGER_APP_EVENT',
    webhook: 'TRIGGER_WEBHOOK',
    email: 'TRIGGER_EMAIL',
    chat: 'TRIGGER_CHAT',
    form: 'TRIGGER_FORM',
  }[kind];
}

function triggerConfig(trigger: AgentArchitectSpec['trigger']): Record<string, unknown> {
  if (trigger.kind === 'schedule') return { cron: trigger.cron ?? '0 9 * * 1-5', timezone: trigger.timezone ?? 'UTC', enabled: true };
  if (trigger.kind === 'event') return { event: trigger.event ?? '' };
  return {};
}

/**
 * The canvas graph a spec describes. Deterministic. Reads and actions are
 * tool steps the engine runs directly; analysing and writing are agents
 * grounded in what earlier steps gathered; a team hangs off a coordinator's
 * Sub-agents slot.
 */
export function specToStudioGraph(spec: AgentArchitectSpec): StudioCanvasGraph {
  const nodes: StudioCanvasNode[] = [];
  const edges: StudioCanvasEdge[] = [];
  let col = 0;
  const place = (id: string, type: string, label: string, config: Record<string, unknown>, subtitle?: string, at?: { x: number; y: number }) => {
    nodes.push({ id, type, position: at ?? { x: 80 + col++ * X_GAP, y: Y_MAIN }, data: { label, ...(subtitle ? { subtitle } : {}), config } });
    return id;
  };
  const link = (source: string, target: string, sourceHandle?: string, label?: string) =>
    edges.push({ id: `e-${source}-${target}${sourceHandle ? `-${sourceHandle}` : ''}`, source, target, ...(sourceHandle ? { sourceHandle } : {}), ...(label ? { label } : {}), animated: true });

  let tail: { id: string; handle?: string } = { id: place('trigger', triggerNodeType(spec.trigger.kind), spec.trigger.label || 'Trigger', triggerConfig(spec.trigger), spec.trigger.kind === 'schedule' ? spec.trigger.timezone : undefined) };
  const attach = (id: string) => {
    link(tail.id, id, tail.handle, tail.handle === 'true' ? 'Yes' : undefined);
    tail = { id };
  };

  const earlier: Array<{ id: string; title: string; type: string }> = [];
  let teamPlaced = false;
  let lastAgent: string | undefined;

  const groundedGoal = (step: ArchitectStep) => {
    const lines = [step.prompt?.trim() || `${step.title}.`, '', 'Today is {{now.weekday}}, {{now.date}}.', 'Request from the person running this, if any: {{input.text}}'];
    if (earlier.length) {
      lines.push('', 'Data gathered by earlier steps:');
      for (const e of earlier) lines.push(`### ${e.title}`, `{{${e.id}.${canvasResultKey(e.type)}}}`);
    }
    lines.push('', `Rules:\n- ${AGENT_GROUNDING_RULES}`);
    return lines.join('\n');
  };

  for (const step of spec.steps) {
    const retries = step.retries !== undefined ? { retries: step.retries } : {};
    if (step.kind === 'approval') {
      attach(place(step.id, 'USER_APPROVAL', step.title, { action: step.title, required: true, ...(step.why ? { description: step.why } : {}) }, 'Waits for a person'));
      continue;
    }
    if (step.kind === 'knowledge') {
      attach(
        place(step.id, 'KB_SEARCH', step.title, { knowledgeBaseId: spec.knowledge.knowledgeBaseId ?? '', topK: 5, query: '{{input.text}} {{__last}}', ...retries }, spec.knowledge.name ?? 'Pick a knowledge base'),
      );
      earlier.push({ id: step.id, title: step.title, type: 'KB_SEARCH' });
      continue;
    }
    if (step.kind === 'condition') {
      attach(place(step.id, 'IF_ELSE', step.title, { expression: step.condition ?? 'exists __last' }, step.condition));
      const stop = `${step.id}__stop`;
      place(stop, 'END', 'Nothing to do', { template: `Stopped at “${step.title}”: the condition was not met, so nothing else ran.` }, undefined, { x: 80 + (col - 1) * X_GAP, y: Y_MAIN + 220 });
      link(step.id, stop, 'false', 'No');
      tail = { id: step.id, handle: 'true' };
      continue;
    }
    if (step.kind === 'analyze' || step.kind === 'generate' || step.kind === 'delegate') {
      if (spec.team && !teamPlaced) {
        teamPlaced = true;
        const lead = place(step.id, 'AGENT_COORDINATOR', `${spec.agent.name}`, {
          instructions: `${spec.agent.instructions}\nYou coordinate a team of specialists. Delegate each part of the work to the right member, then combine their results.`,
          goal: groundedGoal(step),
          delegation: spec.team.mode,
          temperature: spec.agent.temperature,
          ...(spec.agent.model ? { model: spec.agent.model } : {}),
          ...retries,
        }, `Coordinates ${spec.team.members.length} agents`);
        attach(lead);
        spec.team.members.forEach((m, i) => {
          const id = `${m.key}`;
          nodes.push({ id, type: 'SUB_AGENT', position: { x: 80 + (col - 1) * X_GAP - ((spec.team!.members.length - 1) * 240) / 2 + i * 240, y: Y_MAIN + 260 }, data: { label: m.name, subtitle: m.role, config: { role: m.role, instructions: m.instructions } } });
          link(lead, id, 'agents');
        });
        lastAgent = lead;
        earlier.push({ id: step.id, title: step.title, type: 'AGENT_COORDINATOR' });
        continue;
      }
      attach(
        place(step.id, 'AGENT', step.title, {
          instructions: spec.agent.instructions,
          goal: groundedGoal(step),
          temperature: step.kind === 'analyze' ? 0.2 : spec.agent.temperature,
          ...(spec.agent.model ? { model: spec.agent.model } : {}),
          ...retries,
        }, step.kind === 'analyze' ? 'Analyses' : 'Writes'),
      );
      lastAgent = step.id;
      earlier.push({ id: step.id, title: step.title, type: 'AGENT' });
      continue;
    }
    // collect / action / notify — a tool step, behind an approval when it needs one.
    if (step.requiresApproval) {
      attach(place(`${step.id}__approval`, 'USER_APPROVAL', `Approve: ${step.title}`, { action: step.title, required: true, gates: step.id }, 'Waits for a person'));
    }
    const appName = step.app ? (ARCHITECT_APPS.find((a) => a.provider === step.app)?.label ?? appLabel(step.app)) : undefined;
    attach(
      place(
        step.id,
        'MCP_TOOL',
        step.title,
        {
          toolName: step.tool ?? '',
          input: JSON.stringify(step.input ?? {}, null, 2),
          ...(step.app ? { app: step.app, needsConnection: step.app } : {}),
          ...retries,
          ...(step.onFailure ? { onFailure: step.onFailure } : {}),
        },
        step.tool ? (PLATFORM_TOOLS[step.tool]?.label ?? step.tool) : appName ? `Needs ${appName}` : 'Pick a tool',
      ),
    );
    if (step.kind === 'collect') earlier.push({ id: step.id, title: step.title, type: 'MCP_TOOL' });
  }

  const resultFrom = lastAgent ?? earlier[earlier.length - 1]?.id;
  const resultType = nodes.find((n) => n.id === resultFrom)?.type ?? 'MCP_TOOL';
  attach(place('result', 'END', 'Result', { template: resultFrom ? `{{${resultFrom}.${canvasResultKey(resultType)}}}` : 'Done.' }, spec.outputs.join(' · ') || undefined));

  return {
    nodes,
    edges,
    settings: {
      architect: { goal: spec.goal, domain: spec.domain, memory: spec.memory, errorHandling: spec.errorHandling },
    },
  };
}

/* ------------------------------------------------------------- explain -- */

const RUN_TYPES_SKIP = new Set(['STICKY_NOTE', 'NOTE', 'GROUP', 'STAGE']);
const SLOT_HANDLES = new Set(['prompt', 'llm', 'embedding', 'tools', 'agents']);

const nodeLabel = (n: { data?: { label?: unknown }; type?: string; id: string }) =>
  (typeof n.data?.label === 'string' && n.data.label.trim()) || n.type || n.id;

/** The main path through a graph, trigger first (following "Yes" branches, ignoring slot attachments). */
export function mainPath(graph: { nodes: StudioCanvasNode[]; edges: CanvasGraphEdge[] }): StudioCanvasNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const flow = graph.edges.filter((e) => !(e.sourceHandle && SLOT_HANDLES.has(e.sourceHandle)) && e.sourceHandle !== 'false' && e.sourceHandle !== 'error');
  const hasIncoming = new Set(flow.map((e) => e.target));
  const start =
    graph.nodes.find((n) => /^TRIGGER|^START$/.test(String(n.type))) ?? graph.nodes.find((n) => !hasIncoming.has(n.id) && !RUN_TYPES_SKIP.has(String(n.type)));
  const path: StudioCanvasNode[] = [];
  const seen = new Set<string>();
  let current = start;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    const next = flow.find((e) => e.source === current!.id);
    current = next ? byId.get(next.target) : undefined;
  }
  return path;
}

/** `Trigger → Qualify → Personalize → Approve → Send` — the one-line workflow (brief §37). */
export function describeFlowLine(graph: StudioCanvasGraph): string {
  return mainPath(graph)
    .map((n) => nodeLabel(n))
    .join(' → ');
}

const isApproval = (t: string) => ['USER_APPROVAL', 'HUMAN_APPROVAL', 'HUMAN_REVIEW', 'ESCALATE_HUMAN'].includes(t);
const isAgent = (t: string) => ['AGENT', 'SUB_AGENT', 'AGENT_COORDINATOR'].includes(t);

/** A plain-language explanation of what an agent's graph does. */
export function explainStudioGraph(graph: StudioCanvasGraph): string {
  const path = mainPath(graph);
  if (!path.length) return 'The canvas is empty — describe what the agent should do and I’ll build it.';
  const sentences: string[] = [];
  const trigger = path[0]!;
  const cfg = trigger.data?.config ?? {};
  if (trigger.type === 'TRIGGER_SCHEDULE') sentences.push(`It runs ${describeCronExpression(String(cfg['cron'] ?? '')).replace(/^Runs /, '').replace(/^\w/, (c) => c.toLowerCase())}${cfg['timezone'] ? ` (${String(cfg['timezone'])})` : ''}.`);
  else if (trigger.type === 'TRIGGER_APP_EVENT') sentences.push(`It runs when ${String(cfg['event'] || 'an event happens').replace('.', ' is ')}.`);
  else sentences.push('It runs when you start it.');
  const parts: string[] = [];
  for (const n of path.slice(1)) {
    const t = String(n.type);
    const label = nodeLabel(n).toLowerCase();
    // Step labels are imperative ("Get tasks"), so every part reads as one: "it will get tasks, then …".
    if (isApproval(t)) parts.push(`wait for your approval (${label})`);
    else if (isAgent(t)) {
      const members = graph.edges.filter((e) => e.source === n.id && e.sourceHandle === 'agents').length;
      parts.push(members ? `have “${nodeLabel(n)}” coordinate ${members} specialist agents` : `use an AI agent to “${label}”`);
    } else if (t === 'KB_SEARCH') parts.push('search your knowledge base');
    else if (t === 'IF_ELSE') parts.push(`stop early unless “${label}”`);
    else if (t === 'END' || t === 'OUTPUT') continue;
    else if (n.data?.config?.['needsConnection']) parts.push(`${label} (once ${appLabel(String(n.data.config['needsConnection']))} is connected)`);
    else parts.push(label);
  }
  if (parts.length) sentences.push(`Then it will ${parts.join(', then ')}.`);
  const retries = graph.nodes.filter((n) => Number(n.data?.config?.['retries'] ?? 0) > 1).length;
  if (retries) sentences.push(`${retries} step${retries === 1 ? '' : 's'} retry automatically on a temporary failure.`);
  return sentences.join(' ');
}

/* ------------------------------------------------------------------ edits -- */

/** Node types an edit may add — every one of them runs (see `compileStudioGraph`). */
export const EDITABLE_NODE_TYPES = [
  'AGENT',
  'SUB_AGENT',
  'AGENT_COORDINATOR',
  'MCP_TOOL',
  'KB_SEARCH',
  'IF_ELSE',
  'USER_APPROVAL',
  'HUMAN_REVIEW',
  'WAIT_DELAY',
  'HTTP_REQUEST',
  'AI_SUMMARIZER',
  'STRUCTURED_OUTPUT',
  'INTENT_CLASSIFIER',
  'PARALLEL_SPLIT',
  'MERGE_PATHS',
  'LOOP',
  'SET_VARIABLE',
  'FIRECRAWL_SEARCH',
  'END',
] as const;

export type GraphEditOp =
  | { op: 'add_step'; type: string; label: string; config?: Record<string, unknown>; after?: string; before?: string }
  | { op: 'remove_step'; nodeId: string }
  | { op: 'update_step'; nodeId: string; label?: string; config: Record<string, unknown> }
  | { op: 'set_trigger'; kind: ArchitectTriggerKind; cron?: string; timezone?: string; event?: string }
  | { op: 'set_model'; model: string; nodeIds?: string[] }
  | { op: 'set_retries'; retries: number; nodeIds?: string[] }
  | { op: 'insert_approval_before'; nodeIds: string[]; label?: string }
  | { op: 'remove_approval_before'; nodeIds?: string[]; toolName?: string; label?: string }
  | { op: 'set_autonomy'; autonomy: AgentAutonomy; level?: AutonomyLevel }
  | { op: 'add_reviewer'; reviewerName?: string; instructions?: string }
  | { op: 'set_rule'; ruleType: 'always' | 'askBefore' | 'never'; text: string }
  | { op: 'attach_knowledge'; knowledgeBaseId?: string; name?: string }
  | { op: 'convert_to_team'; mode: AgentDelegationMode; members?: Array<{ name: string; role: string; instructions: string }> }
  | { op: 'merge_steps'; keep: string; remove: string };

export interface GraphEditResult {
  graph: StudioCanvasGraph;
  /** Problems with ops that were skipped, in plain words. */
  errors: string[];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function freshId(base: string, graph: StudioCanvasGraph): string {
  const taken = new Set(graph.nodes.map((n) => n.id));
  return uniqueId(base, taken);
}

const isFlowEdge = (e: StudioCanvasEdge) => !(e.sourceHandle && SLOT_HANDLES.has(e.sourceHandle));

/** Inserts a node into the flow after (or before) another, rewiring the edges between them. */
function insertNode(graph: StudioCanvasGraph, node: StudioCanvasNode, where: { after?: string; before?: string }) {
  const anchor = graph.nodes.find((n) => n.id === (where.before ?? where.after));
  node.position = anchor ? { x: anchor.position.x + (where.before ? -40 : 40), y: anchor.position.y + (where.before ? -120 : 120) } : { x: 80, y: Y_MAIN + 300 };
  graph.nodes.push(node);
  if (where.before) {
    const incoming = graph.edges.filter((e) => e.target === where.before && isFlowEdge(e));
    for (const e of incoming) {
      e.target = node.id;
      e.id = `e-${e.source}-${node.id}${e.sourceHandle ? `-${e.sourceHandle}` : ''}`;
    }
    graph.edges.push({ id: `e-${node.id}-${where.before}`, source: node.id, target: where.before, animated: true });
  } else if (where.after) {
    // Only the plain continuation moves; a condition's "No" branch and error branches stay.
    const outgoing = graph.edges.filter((e) => e.source === where.after && isFlowEdge(e) && e.sourceHandle !== 'false' && e.sourceHandle !== 'error');
    for (const e of outgoing) {
      e.source = node.id;
      e.id = `e-${node.id}-${e.target}`;
      delete e.sourceHandle;
    }
    graph.edges.push({ id: `e-${where.after}-${node.id}`, source: where.after, target: node.id, animated: true });
  }
}

const AGENTIC = (t: string) => isAgent(t) || ['AI_CHAT_MODEL', 'LLM', 'AI_SUMMARIZER', 'REASONING_CHAIN', 'AI_TRANSLATOR', 'AI_SENTIMENT', 'INTENT_CLASSIFIER', 'STRUCTURED_OUTPUT'].includes(t);

/** Applies edit ops to a copy of the graph. Ops that don't fit the graph are skipped and reported. */
export function applyGraphEdits(input: StudioCanvasGraph, ops: readonly GraphEditOp[]): GraphEditResult {
  const graph = clone(input);
  const errors: string[] = [];
  const find = (id: string) => graph.nodes.find((n) => n.id === id);

  for (const op of ops) {
    switch (op.op) {
      case 'add_step': {
        if (!(EDITABLE_NODE_TYPES as readonly string[]).includes(op.type)) {
          errors.push(`“${op.label}” wasn’t added: ${op.type} isn’t a step type I can add.`);
          break;
        }
        const anchorId = op.before ?? op.after;
        if (anchorId && !find(anchorId)) {
          errors.push(`“${op.label}” wasn’t added: the step it should go next to isn’t on the canvas.`);
          break;
        }
        const node: StudioCanvasNode = { id: freshId(op.label, graph), type: op.type, position: { x: 0, y: 0 }, data: { label: op.label, config: { ...(op.config ?? {}) } } };
        const end = graph.nodes.find((n) => n.type === 'END' && n.id === 'result') ?? graph.nodes.find((n) => n.type === 'END' || n.type === 'OUTPUT');
        insertNode(graph, node, op.before || op.after ? { before: op.before, after: op.after } : end ? { before: end.id } : {});
        break;
      }
      case 'remove_step': {
        const node = find(op.nodeId);
        if (!node) {
          errors.push('A step to remove isn’t on the canvas.');
          break;
        }
        if (/^TRIGGER|^START$/.test(node.type)) {
          errors.push('The trigger can’t be removed — change it instead.');
          break;
        }
        const incoming = graph.edges.filter((e) => e.target === node.id && isFlowEdge(e));
        const outgoing = graph.edges.filter((e) => e.source === node.id && isFlowEdge(e) && e.sourceHandle !== 'false' && e.sourceHandle !== 'error');
        graph.edges = graph.edges.filter((e) => e.source !== node.id && e.target !== node.id);
        for (const i of incoming) for (const o of outgoing) {
          if (!graph.edges.some((e) => e.source === i.source && e.target === o.target && (e.sourceHandle ?? null) === (i.sourceHandle ?? null))) {
            graph.edges.push({ id: `e-${i.source}-${o.target}${i.sourceHandle ? `-${i.sourceHandle}` : ''}`, source: i.source, target: o.target, ...(i.sourceHandle ? { sourceHandle: i.sourceHandle } : {}), animated: true });
          }
        }
        graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
        break;
      }
      case 'update_step': {
        const node = find(op.nodeId);
        if (!node) {
          errors.push('A step to change isn’t on the canvas.');
          break;
        }
        node.data = { ...node.data, ...(op.label ? { label: op.label } : {}), config: { ...(node.data.config ?? {}), ...op.config } };
        break;
      }
      case 'set_trigger': {
        const trigger = graph.nodes.find((n) => /^TRIGGER|^START$/.test(n.type));
        const type = triggerNodeType(op.kind);
        const config = op.kind === 'schedule' ? { cron: op.cron ?? '0 9 * * 1-5', timezone: op.timezone ?? String(trigger?.data.config?.['timezone'] ?? 'UTC'), enabled: true } : op.kind === 'event' ? { event: op.event ?? '' } : {};
        const label = op.kind === 'schedule' ? describeCronExpression(String(config['cron'])) : describeTrigger({ kind: op.kind, ...(op.event ? { event: op.event } : {}), label: '' });
        if (trigger) {
          trigger.type = type;
          trigger.data = { ...trigger.data, label, config };
          if (op.kind === 'schedule') trigger.data.subtitle = String(config['timezone']);
        } else {
          const node: StudioCanvasNode = { id: freshId('trigger', graph), type, position: { x: -220, y: Y_MAIN }, data: { label, config } };
          const first = mainPath(graph)[0];
          graph.nodes.push(node);
          if (first) graph.edges.push({ id: `e-${node.id}-${first.id}`, source: node.id, target: first.id, animated: true });
        }
        break;
      }
      case 'set_model': {
        const targets = graph.nodes.filter((n) => (op.nodeIds?.length ? op.nodeIds.includes(n.id) : AGENTIC(n.type)));
        if (!targets.length) {
          errors.push('There are no AI steps to change the model of.');
          break;
        }
        for (const n of targets) n.data.config = { ...(n.data.config ?? {}), model: op.model };
        break;
      }
      case 'set_retries': {
        const retries = Math.min(Math.max(Math.round(op.retries), 0), 5);
        const targets = graph.nodes.filter((n) =>
          op.nodeIds?.length ? op.nodeIds.includes(n.id) : !/^TRIGGER|^START$/.test(n.type) && !isApproval(n.type) && !['END', 'OUTPUT', 'IF_ELSE', 'STICKY_NOTE'].includes(n.type),
        );
        for (const n of targets) n.data.config = { ...(n.data.config ?? {}), retries };
        if (op.retries > 5) errors.push('Steps retry at most 5 times, so I used 5.');
        break;
      }
      case 'insert_approval_before': {
        for (const id of op.nodeIds) {
          const target = find(id);
          if (!target) continue;
          const already = graph.edges.some((e) => e.target === id && isApproval(find(e.source)?.type ?? ''));
          if (already) continue;
          insertNode(
            graph,
            { id: freshId(`approve_${id}`, graph), type: 'USER_APPROVAL', position: { x: 0, y: 0 }, data: { label: op.label ?? `Approve: ${nodeLabel(target)}`, subtitle: 'Waits for a person', config: { action: nodeLabel(target), required: true, gates: id } } },
            { before: id },
          );
        }
        break;
      }
      case 'remove_approval_before': {
        const approvalNodesToRemove = new Set<string>();
        // Find approvals matching specified nodeIds or toolName/CRM
        for (const node of graph.nodes) {
          if (!isApproval(node.type)) continue;
          const gatedTarget = String(node.data.config?.['gates'] ?? '');
          const outgoing = graph.edges.filter((e) => e.source === node.id && isFlowEdge(e));
          const directTarget = outgoing[0]?.target;
          const targetNode = find(gatedTarget) ?? (directTarget ? find(directTarget) : undefined);

          // No target named → every approval step goes.
          let matches = !op.nodeIds?.length && !op.toolName;
          if (op.nodeIds?.length) {
            matches = op.nodeIds.includes(node.id) || (targetNode ? op.nodeIds.includes(targetNode.id) : false);
          } else if (op.toolName) {
            const needle = op.toolName.toLowerCase();
            const label = ((targetNode ? nodeLabel(targetNode) : '') + ' ' + (node.data.label ?? '')).toLowerCase();
            const tool = String(targetNode?.data.config?.['toolName'] ?? '').toLowerCase();
            const app = String(targetNode?.data.config?.['needsConnection'] ?? '').toLowerCase();
            matches = label.includes(needle) || tool.includes(needle) || app.includes(needle);
            if (!matches && needle === 'crm') {
              matches = label.includes('crm') || label.includes('lead') || label.includes('salesforce') || label.includes('hubspot');
            }
          }
          if (matches) approvalNodesToRemove.add(node.id);
        }

        if (approvalNodesToRemove.size === 0) {
          errors.push('There is no matching approval step to remove.');
          break;
        }

        for (const approvalId of approvalNodesToRemove) {
          const approvalNode = find(approvalId);
          if (!approvalNode) continue;
          const incoming = graph.edges.filter((e) => e.target === approvalId && isFlowEdge(e));
          const outgoing = graph.edges.filter((e) => e.source === approvalId && isFlowEdge(e));
          graph.edges = graph.edges.filter((e) => e.source !== approvalId && e.target !== approvalId);
          for (const i of incoming) {
            for (const o of outgoing) {
              if (!graph.edges.some((e) => e.source === i.source && e.target === o.target)) {
                graph.edges.push({ id: `e-${i.source}-${o.target}`, source: i.source, target: o.target, animated: true });
              }
            }
          }
          graph.nodes = graph.nodes.filter((n) => n.id !== approvalId);
        }
        break;
      }
      case 'set_autonomy': {
        const agentNodes = graph.nodes.filter((n) => AGENTIC(n.type));
        for (const n of agentNodes) {
          n.data.config = {
            ...(n.data.config ?? {}),
            autonomy: op.autonomy,
            autonomyLevel: op.level ?? legacyToAutonomyLevel(op.autonomy),
          };
        }
        break;
      }
      case 'add_reviewer': {
        const coord = graph.nodes.find((n) => n.type === 'AGENT_COORDINATOR');
        const reviewerLabel = op.reviewerName ?? 'Reviewer Agent';
        const instructions = op.instructions ?? 'Review previous outputs against accuracy, quality, and policy rules. Suggest improvements or approve.';
        if (coord) {
          const id = freshId('reviewer', graph);
          const at = coord.position;
          graph.nodes.push({
            id,
            type: 'SUB_AGENT',
            position: { x: at.x + 240, y: at.y + 260 },
            data: { label: reviewerLabel, subtitle: 'Reviewer', config: { role: 'Reviewer', instructions } },
          });
          graph.edges.push({ id: `e-${coord.id}-${id}-agents`, source: coord.id, target: id, sourceHandle: 'agents' });
          // The team now ends with a review pass over the workers' output.
          coord.data.config = { ...(coord.data.config ?? {}), delegation: 'review_loop' };
        } else {
          const lastAgent = [...mainPath(graph)].reverse().find((n) => AGENTIC(n.type));
          const node: StudioCanvasNode = {
            id: freshId('reviewer', graph),
            type: 'AGENT',
            position: { x: 0, y: 0 },
            data: { label: reviewerLabel, subtitle: 'Reviews & verifies work', config: { goal: instructions, role: 'Reviewer' } },
          };
          insertNode(graph, node, lastAgent ? { after: lastAgent.id } : {});
        }
        break;
      }
      case 'set_rule': {
        const agentNodes = graph.nodes.filter((n) => AGENTIC(n.type));
        for (const n of agentNodes) {
          const existingRules = (n.data.config?.['rules'] as Record<string, unknown>) ?? { always: [], askBefore: [], never: [], policies: {} };
          const list = Array.isArray(existingRules[op.ruleType]) ? [...(existingRules[op.ruleType] as string[])] : [];
          if (!list.includes(op.text)) list.push(op.text);
          n.data.config = {
            ...(n.data.config ?? {}),
            rules: { ...existingRules, [op.ruleType]: list },
          };
        }
        break;
      }
      case 'attach_knowledge': {
        const existing = graph.nodes.find((n) => n.type === 'KB_SEARCH');
        if (existing) {
          existing.data.config = { ...(existing.data.config ?? {}), ...(op.knowledgeBaseId ? { knowledgeBaseId: op.knowledgeBaseId } : {}) };
          if (op.name) existing.data.subtitle = op.name;
          break;
        }
        const firstAgent = mainPath(graph).find((n) => AGENTIC(n.type));
        const node: StudioCanvasNode = {
          id: freshId('search_knowledge', graph),
          type: 'KB_SEARCH',
          position: { x: 0, y: 0 },
          data: { label: op.name ? `Search ${op.name}` : 'Search company knowledge', subtitle: op.name ?? 'Pick a knowledge base', config: { knowledgeBaseId: op.knowledgeBaseId ?? '', topK: 5, query: '{{input.text}} {{__last}}' } },
        };
        insertNode(graph, node, firstAgent ? { before: firstAgent.id } : {});
        if (firstAgent && typeof firstAgent.data.config?.['goal'] === 'string' && !String(firstAgent.data.config['goal']).includes(`{{${node.id}.`)) {
          firstAgent.data.config = {
            ...firstAgent.data.config,
            goal: `${String(firstAgent.data.config['goal'])}\n\n### From the knowledge base\n{{${node.id}.retrievedDocuments}}\nCite the documents you used.`,
          };
        }
        break;
      }
      case 'convert_to_team': {
        const path = mainPath(graph);
        const agents = path.filter((n) => AGENTIC(n.type));
        if (graph.nodes.some((n) => n.type === 'AGENT_COORDINATOR')) {
          errors.push('This agent is already a team.');
          break;
        }
        const members = op.members?.length
          ? op.members
          : agents.map((a) => ({ name: nodeLabel(a), role: nodeLabel(a), instructions: String(a.data.config?.['goal'] ?? a.data.config?.['instructions'] ?? `Do this: ${nodeLabel(a)}`) }));
        if (members.length < 2) {
          errors.push('A team needs at least two distinct jobs. Add another AI step, or tell me which specialists you want.');
          break;
        }
        // The first AI step becomes the coordinator; the others leave the flow and join its team.
        const lead = agents[0];
        const leadId = lead?.id ?? freshId('coordinator', graph);
        if (lead) {
          lead.type = 'AGENT_COORDINATOR';
          lead.data = {
            ...lead.data,
            label: 'Coordinator',
            subtitle: `Coordinates ${members.length} agents`,
            config: { ...(lead.data.config ?? {}), delegation: op.mode, instructions: `${String(lead.data.config?.['instructions'] ?? '')}\nYou coordinate a team of specialists. Delegate each part of the work to the right member, then combine their results.`.trim() },
          };
        }
        const fromFlow = op.members?.length ? [] : agents.slice(1);
        for (const a of fromFlow) {
          // Take it out of the flow (rewired around), then hang it off the coordinator.
          const incoming = graph.edges.filter((e) => e.target === a.id && isFlowEdge(e));
          const outgoing = graph.edges.filter((e) => e.source === a.id && isFlowEdge(e));
          graph.edges = graph.edges.filter((e) => !(isFlowEdge(e) && (e.source === a.id || e.target === a.id)));
          for (const i of incoming) for (const o of outgoing) graph.edges.push({ id: `e-${i.source}-${o.target}`, source: i.source, target: o.target, ...(i.sourceHandle ? { sourceHandle: i.sourceHandle } : {}), animated: true });
          a.type = 'SUB_AGENT';
          a.data = { ...a.data, config: { ...(a.data.config ?? {}), role: nodeLabel(a), instructions: String(a.data.config?.['goal'] ?? a.data.config?.['instructions'] ?? '') } };
          graph.edges.push({ id: `e-${leadId}-${a.id}-agents`, source: leadId, target: a.id, sourceHandle: 'agents' });
        }
        if (op.members?.length) {
          op.members.forEach((m, i) => {
            const id = freshId(`${m.name}`, graph);
            const at = lead?.position ?? { x: 400, y: Y_MAIN };
            graph.nodes.push({ id, type: 'SUB_AGENT', position: { x: at.x - ((op.members!.length - 1) * 240) / 2 + i * 240, y: at.y + 260 }, data: { label: m.name, subtitle: m.role, config: { role: m.role, instructions: m.instructions } } });
            graph.edges.push({ id: `e-${leadId}-${id}-agents`, source: leadId, target: id, sourceHandle: 'agents' });
          });
        }
        break;
      }
      case 'merge_steps': {
        const keep = find(op.keep);
        const remove = find(op.remove);
        if (!keep || !remove) {
          errors.push('Steps to merge aren’t on the canvas.');
          break;
        }
        const goal = (n: StudioCanvasNode) => String(n.data.config?.['goal'] ?? n.data.config?.['prompt'] ?? `${nodeLabel(n)}.`);
        keep.data = {
          ...keep.data,
          label: `${nodeLabel(keep)} + ${nodeLabel(remove)}`,
          config: { ...(keep.data.config ?? {}), goal: `${goal(keep)}\n\nThen, in the same answer: ${goal(remove).split('\n\nData gathered by earlier steps:')[0]}` },
        };
        const outgoing = graph.edges.filter((e) => e.source === remove.id && isFlowEdge(e));
        graph.edges = graph.edges.filter((e) => e.source !== remove.id && e.target !== remove.id);
        graph.edges = graph.edges.filter((e) => !(e.source === keep.id && isFlowEdge(e) && e.sourceHandle !== 'false' && e.sourceHandle !== 'error'));
        for (const o of outgoing) graph.edges.push({ id: `e-${keep.id}-${o.target}`, source: keep.id, target: o.target, animated: true });
        graph.nodes = graph.nodes.filter((n) => n.id !== remove.id);
        // References to the removed step now read the merged one.
        const ref = new RegExp(`\\{\\{${remove.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[a-zA-Z]+\\}\\}`, 'g');
        for (const n of graph.nodes) {
          for (const [k, v] of Object.entries(n.data.config ?? {})) {
            if (typeof v === 'string' && ref.test(v)) n.data.config[k] = v.replace(ref, `{{${keep.id}.${canvasResultKey(keep.type)}}}`);
          }
        }
        break;
      }
    }
  }
  return { graph, errors };
}

/* ------------------------------------------------------------------- diff -- */

export interface GraphDiff {
  added: string[];
  removed: string[];
  changed: Array<{ label: string; fields: string[] }>;
  rewired: boolean;
  /** One line per change, in plain words. */
  summary: string[];
  /** Whether anything changed at all. */
  changedAnything: boolean;
}

const FIELD_NAMES: Record<string, string> = {
  model: 'model',
  cron: 'schedule',
  timezone: 'time zone',
  retries: 'retries',
  instructions: 'instructions',
  goal: 'task',
  knowledgeBaseId: 'knowledge base',
  toolName: 'tool',
  input: 'tool input',
  delegation: 'delegation mode',
  event: 'event',
  expression: 'condition',
};

const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );

/** What changed between two graphs, positions ignored — computed, so “nothing else changed” is a fact. */
export function diffStudioGraphs(before: StudioCanvasGraph, after: StudioCanvasGraph): GraphDiff {
  const a = new Map(before.nodes.map((n) => [n.id, n]));
  const b = new Map(after.nodes.map((n) => [n.id, n]));
  const added = after.nodes.filter((n) => !a.has(n.id)).map((n) => nodeLabel(n));
  const removed = before.nodes.filter((n) => !b.has(n.id)).map((n) => nodeLabel(n));
  const changed: GraphDiff['changed'] = [];
  for (const [id, next] of b) {
    const prev = a.get(id);
    if (!prev) continue;
    const fields: string[] = [];
    if (prev.type !== next.type) fields.push('type');
    if (nodeLabel(prev) !== nodeLabel(next)) fields.push('name');
    const pc = prev.data?.config ?? {};
    const nc = next.data?.config ?? {};
    for (const key of new Set([...Object.keys(pc), ...Object.keys(nc)])) {
      if (stableStringify(pc[key]) !== stableStringify(nc[key])) fields.push(FIELD_NAMES[key] ?? key);
    }
    if (fields.length) changed.push({ label: nodeLabel(next), fields: [...new Set(fields)] });
  }
  const edgeKey = (e: StudioCanvasEdge) => `${e.source}>${e.target}:${e.sourceHandle ?? ''}`;
  const ea = new Set(before.edges.map(edgeKey));
  const eb = new Set(after.edges.map(edgeKey));
  const rewired = ea.size !== eb.size || [...eb].some((k) => !ea.has(k));

  const summary: string[] = [];
  for (const l of added) summary.push(`Added “${l}”`);
  for (const l of removed) summary.push(`Removed “${l}”`);
  for (const c of changed) {
    const node = after.nodes.find((n) => nodeLabel(n) === c.label);
    if (node && /^TRIGGER|^START$/.test(node.type)) summary.push(`Changed the trigger to “${c.label}”`);
    else summary.push(`Changed ${c.fields.join(', ')} of “${c.label}”`);
  }
  if (rewired && !added.length && !removed.length) summary.push('Rewired the steps');
  return { added, removed, changed, rewired, summary, changedAnything: summary.length > 0 };
}

/* -------------------------------------------------------- interpretation -- */

export interface EditInterpretationContext {
  /** Reads a schedule out of words ("every Monday at 9am") — `parseScheduleText` from `@org/utils`. */
  parseSchedule?: (text: string) => { cron: string } | null;
  connectedApps: readonly string[];
  appActions?: ArchitectContext['appActions'];
  knowledgeBases: ReadonlyArray<{ id: string; name: string }>;
  /** Models the workspace can actually use. */
  models: ReadonlyArray<{ id: string; label: string; provider: string }>;
  timezone?: string;
}

export interface EditInterpretation {
  ops: GraphEditOp[];
  /** What I'll do, in the person's terms ("I'll add Slack after the report is generated."). */
  explanation: string;
  /** Things to tell the person that aren't changes (an app that must be connected). */
  notes: string[];
}

const NUMBER_WORDS: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, three: 3, thrice: 3, four: 4, five: 5 };

const OUTWARD_NODE = (n: StudioCanvasNode) => {
  const t = n.type;
  if (['SLACK_SEND', 'EMAIL_SEND'].includes(t)) return true;
  if (t !== 'MCP_TOOL' && t !== 'TOOL') return false;
  const tool = String(n.data.config?.['toolName'] ?? '');
  if (PLATFORM_TOOLS[tool]) return !!PLATFORM_TOOLS[tool]!.approvalByDefault || /send|post/.test(tool);
  return OUTWARD_TOOL.test(tool) || OUTWARD_TOOL.test(nodeLabel(n)) || !!n.data.config?.['needsConnection'];
};

/**
 * Turns the common requests into edit ops without a model — instant and
 * predictable. Returns null when it doesn't recognise the request, so the
 * caller can ask a model instead.
 */
export function interpretEditCommand(text: string, graph: StudioCanvasGraph, ctx: EditInterpretationContext): EditInterpretation | null {
  const t = text.toLowerCase().trim();
  const path = mainPath(graph);
  const ops: GraphEditOp[] = [];
  const explain: string[] = [];
  const notes: string[] = [];
  const end = graph.nodes.find((n) => n.id === 'result') ?? [...path].reverse().find((n) => n.type === 'END' || n.type === 'OUTPUT');
  const lastAgent = [...path].reverse().find((n) => AGENTIC(n.type));

  // Pausing/resuming is about runs, not the design — an edit can't do it, so
  // say so rather than claim it happened. Only a command that is *just* that.
  if (/^(please )?(pause|resume|halt|stop working|stop|continue)( (this|the) agent| it| working| execution)?[.!]*$/.test(t)) {
    explain.push('Editing the design can’t pause or resume this agent.');
    notes.push('Turn its schedule off, or stop a run from the run console, to pause it.');
    return { ops: [], explanation: explain.join(' '), notes };
  }

  // Remove approval or "don't ask before <action>"
  const removeApproval = /\b(don'?t ask|do not ask|skip (the )?approval|remove (the )?approval|no approval|stop asking|without approval)\b/.test(t);
  if (removeApproval) {
    const isCrm = /\b(crm|lead|hubspot|salesforce|contact|record)\b/.test(t);
    const targetTool = isCrm ? 'crm' : undefined;
    ops.push({ op: 'remove_approval_before', toolName: targetTool });
    explain.push(isCrm ? 'I’ll remove the approval step before CRM updates so records are updated automatically.' : 'I’ll remove the approval requirement.');
    notes.push('Other approval rules remain unchanged.');
  }

  // Autonomy command ("make this agent autonomous")
  if (/\b(make (this |the |it )?agent autonomous|make it autonomous|set autonomy to autonomous|autonomous mode|enable autonomy)\b/.test(t)) {
    ops.push({ op: 'set_autonomy', autonomy: 'autonomous', level: 4 });
    explain.push('I’ll set this agent to Autonomous mode (Level 4). It will plan work and execute actions automatically within defined boundaries.');
    notes.push('High-risk and sensitive actions will still respect configured approval policies.');
  }

  // Add reviewer agent ("add a reviewer agent")
  if (/\b(add|include|attach)\b.*\b(reviewer|critic|review agent|reviewer agent|review step)\b/.test(t)) {
    ops.push({ op: 'add_reviewer', reviewerName: 'Reviewer Agent' });
    explain.push('I’ll add a Reviewer agent to inspect outputs and ensure quality before concluding tasks.');
  }

  // Structured rules: "always ...", "never ...", "stop deleting ..."
  // Approval phrasing ("always ask me before…", "stop asking before…") is
  // handled as approval steps, not as free-text rules.
  const approvalPhrasing = removeApproval || /\b(ask (me|us|first)|approv\w*|check with me|sign[- ]off)\b/.test(t);
  const neverRule = approvalPhrasing ? null : t.match(/\b(?:never|stop)\s+([a-z0-9][a-z0-9 _-]{2,80})/);
  if (neverRule && !/\b(working|execution|this agent|halt)\b/.test(neverRule[1]!)) {
    const ruleText = neverRule[1]!.trim();
    ops.push({ op: 'set_rule', ruleType: 'never', text: ruleText });
    explain.push(`I’ll add a rule to never ${ruleText}.`);
  }
  const alwaysRule = approvalPhrasing ? null : t.match(/\b(?:always|ensure you|make sure to)\s+([a-z0-9][a-z0-9 _-]{2,80})/);
  if (alwaysRule) {
    const ruleText = alwaysRule[1]!.trim();
    ops.push({ op: 'set_rule', ruleType: 'always', text: ruleText });
    explain.push(`I’ll add a rule to always ${ruleText}.`);
  }

  // Approval before sending / before anything.
  const wantsApproval = !removeApproval && /\b(approv\w*|human (in the loop|review)|review (it |them )?before|sign[- ]off|check with me|ask me before)\b/.test(t);
  if (wantsApproval) {
    const outward = path.filter(OUTWARD_NODE);
    const candidates = /\b(anything|everything|all actions|any action)\b/.test(t) ? path.filter((n) => OUTWARD_NODE(n) || (n.type === 'MCP_TOOL' && !PLATFORM_TOOLS[String(n.data.config?.['toolName'] ?? '')]?.scope.endsWith(':read'))) : outward;
    // A step that already waits for a person right before it needs no second approval.
    const precededByApproval = (id: string) => {
      const before = path.findIndex((n) => n.id === id) - 1;
      return before >= 0 && isApproval(path[before]!.type);
    };
    const targets = candidates.filter((n) => !precededByApproval(n.id));
    const covered = candidates.filter((n) => precededByApproval(n.id));
    if (covered.length) notes.push(`It already waits for your approval before ${covered.map((n) => `“${nodeLabel(n)}”`).join(', ')}.`);
    if (targets.length) {
      ops.push({ op: 'insert_approval_before', nodeIds: targets.map((n) => n.id) });
      explain.push(`I’ll add a human approval before ${targets.map((n) => `“${nodeLabel(n)}”`).join(', ')}.`);
    } else if (end && !covered.length) {
      ops.push({ op: 'insert_approval_before', nodeIds: [end.id], label: 'Approve the result' });
      explain.push('Nothing in it sends anything yet, so I’ll add an approval before the result is final.');
    }
  }

  // Notifications / delivery through an app or a channel.
  const notify = t.match(/\b(add|send|post|notify|deliver|share)\b.*\b(slack|teams|microsoft teams|gmail|e-?mail|channel|#[a-z0-9_-]+|notification)/);
  // "Approval before sending emails" is about the approval, not a new email step.
  if (notify && !/\bremove\b/.test(t) && !(wantsApproval && /\bbefore\b/.test(t))) {
    const channel = t.match(/#([a-z0-9][a-z0-9_-]*)/)?.[1];
    const app = /\bslack\b/.test(t) ? 'SLACK' : /\b(microsoft )?teams\b/.test(t) ? 'MICROSOFT_TEAMS' : /\b(gmail|e-?mail)\b/.test(t) ? 'GMAIL' : undefined;
    const after = lastAgent?.id;
    if (channel && !app) {
      ops.push({ op: 'add_step', type: 'MCP_TOOL', label: `Post in #${channel}`, config: { toolName: 'send_channel_message', input: JSON.stringify({ channelSlug: channel, text: lastAgent ? `{{${lastAgent.id}.${canvasResultKey(lastAgent.type)}}}` : '{{__last}}' }, null, 2) }, ...(after ? { after } : {}) });
      explain.push(`I’ll post the result in #${channel}${lastAgent ? ` after “${nodeLabel(lastAgent)}”` : ''}.`);
    } else if (app) {
      const label = ARCHITECT_APPS.find((a) => a.provider === app)?.label ?? appLabel(app);
      const picked = ctx.connectedApps.includes(app) ? pickAppAction(ctx as ArchitectContext, app, 'output') : undefined;
      ops.push({
        op: 'add_step',
        type: 'MCP_TOOL',
        label: `${app === 'GMAIL' ? 'Email' : 'Notify in'} ${app === 'GMAIL' ? 'the result' : label}`,
        config: picked
          ? { toolName: picked.tool, input: JSON.stringify({ text: lastAgent ? `{{${lastAgent.id}.${canvasResultKey(lastAgent.type)}}}` : '{{__last}}' }, null, 2) }
          : { toolName: '', app, needsConnection: app, input: '{}' },
        ...(after ? { after } : {}),
      });
      explain.push(`I’ll add ${label} ${lastAgent ? `after “${nodeLabel(lastAgent)}”` : 'before the result'}.`);
      if (!picked) notes.push(`${label} isn’t connected yet — connect it before this step can run.`);
    } else if (/notification/.test(t)) {
      ops.push({ op: 'add_step', type: 'MCP_TOOL', label: 'Notify me', config: { toolName: 'notify_user', input: JSON.stringify({ title: 'Agent finished', body: '{{__last}}' }, null, 2) }, ...(after ? { after } : {}) });
      explain.push('I’ll send you a notification with the result.');
    }
  }

  // Model.
  const modelWord = t.match(/\b(?:use|switch to|change (?:the )?model to|run (?:it )?(?:on|with))\s+([a-z0-9][a-z0-9 .-]{1,40}?)(?:\s+(?:instead|model|for|as)\b|[.!]|$)/);
  if (modelWord && /\b(claude|gpt|openai|gemini|llama|mistral|deepseek|qwen|nemotron|sonnet|opus|haiku|o\d|grok|model)\b/.test(modelWord[1]!)) {
    const wanted = modelWord[1]!.replace(/\binstead\b.*$/, '').trim();
    const tokens = wanted.split(/[\s-]+/).filter((w) => w.length > 1 && w !== 'model');
    const scored = ctx.models
      .map((m) => ({ m, score: tokens.reduce((n, w) => n + (`${m.id} ${m.label} ${m.provider}`.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score);
    if (scored[0]) {
      ops.push({ op: 'set_model', model: scored[0].m.id });
      explain.push(`I’ll switch the AI steps to ${scored[0].m.label}.`);
    } else {
      notes.push(`No ${wanted} model is set up in this workspace. Add its provider in Settings → AI providers, then ask again.`);
    }
  }

  // Schedule.
  if (/\b(run|schedule|every|each|daily|weekly|hourly|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|weekdays?|morning|evening)\b/.test(t) && !/\bremove\b/.test(t) && !notify) {
    const parsed = ctx.parseSchedule?.(text);
    if (parsed) {
      ops.push({ op: 'set_trigger', kind: 'schedule', cron: parsed.cron, ...(ctx.timezone ? { timezone: ctx.timezone } : {}) });
      explain.push(`I’ll run it ${describeCronExpression(parsed.cron).replace(/^Runs /, '').replace(/^\w/, (c) => c.toLowerCase())}.`);
    } else if (/\b(manual|on demand)\b/.test(t)) {
      ops.push({ op: 'set_trigger', kind: 'manual' });
      explain.push('I’ll make it run only when you start it.');
    }
  }

  // Retries.
  const retry = t.match(/\bretr(?:y|ies)\b[^.]*?\b(\d+|once|twice|thrice|one|two|three|four|five)\b/) ?? t.match(/\b(\d+|one|two|three|four|five)\s+(?:times|retries)\b/);
  if (/\bretr(y|ies)\b|handl\w* failures?|resilient|robust/.test(t)) {
    const n = retry ? (NUMBER_WORDS[retry[1]!] ?? Number(retry[1])) : 3;
    const apiOnly = /\b(api|app|tool|http) calls?\b/.test(t);
    const targets = apiOnly ? graph.nodes.filter((n2) => ['MCP_TOOL', 'HTTP_REQUEST', 'FIRECRAWL_SEARCH'].includes(n2.type)).map((n2) => n2.id) : undefined;
    ops.push({ op: 'set_retries', retries: n, ...(targets?.length ? { nodeIds: targets } : {}) });
    explain.push(`I’ll make ${apiOnly ? 'app and API calls' : 'its steps'} retry up to ${Math.min(n, 5)} time${n === 1 ? '' : 's'} on a temporary failure.`);
  }

  // Knowledge.
  if (/\b(knowledge( base)?|our (docs|documents|documentation)|company (docs|documents|documentation|knowledge)|these documents|rag)\b/.test(t)) {
    const named = ctx.knowledgeBases.find((kb) => t.includes(kb.name.toLowerCase()));
    const kb = named ?? (ctx.knowledgeBases.length === 1 ? ctx.knowledgeBases[0] : undefined);
    ops.push({ op: 'attach_knowledge', ...(kb ? { knowledgeBaseId: kb.id, name: kb.name } : {}) });
    explain.push(kb ? `I’ll have it search “${kb.name}” before it writes.` : 'I’ll add a knowledge search before it writes.');
    if (!kb) notes.push(ctx.knowledgeBases.length ? 'Pick which knowledge base it should search on the new step.' : 'You have no knowledge base yet — upload documents in Knowledge, then pick it on the new step.');
  }

  // Multi-agent.
  // With fewer than two AI steps the specialists have to be designed — a model does that.
  if (/\b(multi[- ]?agent|multiple agents|specialist agents|team of agents|split (this|it) into|sub[- ]?agents|orchestrator)\b/.test(t)) {
    const aiSteps = path.filter((n) => AGENTIC(n.type)).length;
    if (aiSteps < 2 && !ops.length) return null;
    if (aiSteps >= 2) {
      ops.push({ op: 'convert_to_team', mode: /\bin order|sequential|one after\b/.test(t) ? 'sequential' : /\bparallel|at once|same time\b/.test(t) ? 'parallel' : 'router' });
      explain.push('I’ll turn the AI steps into a team: a coordinator that delegates to specialist agents.');
    } else {
      notes.push('A team needs at least two distinct jobs — tell me which specialists you want.');
    }
  }

  // "Connect Salesforce and Gmail" — connecting happens in Integrations; steps waiting on an app now connected get its action.
  if (/\b(connect|reconnect|link)\b/.test(t)) {
    const named = ARCHITECT_APPS.filter((a) => a.names.some((n) => t.includes(n)));
    for (const app of named) {
      const waiting = graph.nodes.filter((n) => n.data.config?.['needsConnection'] === app.provider && !n.data.config?.['toolName']);
      if (ctx.connectedApps.includes(app.provider)) {
        let fixed = 0;
        for (const node of waiting) {
          const picked = pickAppAction(ctx as ArchitectContext, app.provider, /read|fetch|check|find|search|monitor/i.test(nodeLabel(node)) ? 'input' : 'output');
          if (!picked) continue;
          ops.push({ op: 'update_step', nodeId: node.id, config: { toolName: picked.tool, needsConnection: '' } });
          fixed++;
        }
        if (fixed) explain.push(`${app.label} is connected — I’ll point ${fixed === 1 ? 'its step' : `its ${fixed} steps`} at it.`);
        else notes.push(`${app.label} is already connected.`);
      } else {
        notes.push(`Connect ${app.label} in Integrations${waiting.length ? ` — ${waiting.length === 1 ? 'one step is' : `${waiting.length} steps are`} waiting for it` : ''}, then ask me to “check connections”.`);
      }
    }
  }

  // Remove a named step.
  const remove = t.match(/\b(?:remove|delete|drop)\s+(?:the\s+)?(.+?)(?:\s+step)?\s*$/);
  if (remove) {
    const needle = remove[1]!.replace(/\bstep\b/, '').trim();
    const target = graph.nodes.find((n) => nodeLabel(n).toLowerCase() === needle) ?? graph.nodes.find((n) => nodeLabel(n).toLowerCase().includes(needle));
    if (target && !/^TRIGGER|^START$/.test(target.type)) {
      ops.push({ op: 'remove_step', nodeId: target.id });
      explain.push(`I’ll remove “${nodeLabel(target)}” and reconnect the steps around it.`);
    }
  }

  if (!ops.length && !notes.length) return null;
  return { ops, explanation: explain.join(' ') || 'Nothing on the canvas needs to change for that.', notes };
}

/** Ops a model proposed, kept only when each one is well-formed and points at real steps. */
export function sanitizeEditOps(raw: unknown, graph: StudioCanvasGraph, ctx: Pick<EditInterpretationContext, 'models' | 'knowledgeBases'>): { ops: GraphEditOp[]; dropped: number } {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { ops?: unknown }).ops) ? (raw as { ops: unknown[] }).ops : [];
  const ops: GraphEditOp[] = [];
  let dropped = 0;
  const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const config = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (JSON.parse(JSON.stringify(v)) as Record<string, unknown>) : {});
  for (const entry of list.slice(0, 12)) {
    const o = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const ref = (k: string) => (str(o[k], 80) && ids.has(str(o[k], 80)!) ? str(o[k], 80) : undefined);
    switch (o['op']) {
      case 'add_step': {
        const type = str(o['type'], 40)?.toUpperCase();
        const label = str(o['label'], 120);
        if (!type || !label || !(EDITABLE_NODE_TYPES as readonly string[]).includes(type)) break;
        ops.push({ op: 'add_step', type, label, config: config(o['config']), ...(ref('after') ? { after: ref('after') } : {}), ...(ref('before') ? { before: ref('before') } : {}) });
        continue;
      }
      case 'remove_step':
        if (ref('nodeId')) { ops.push({ op: 'remove_step', nodeId: ref('nodeId')! }); continue; }
        break;
      case 'update_step':
        if (ref('nodeId')) { ops.push({ op: 'update_step', nodeId: ref('nodeId')!, ...(str(o['label'], 120) ? { label: str(o['label'], 120) } : {}), config: config(o['config']) }); continue; }
        break;
      case 'set_trigger': {
        const kind = str(o['kind'], 20) as ArchitectTriggerKind | undefined;
        if (kind && ['manual', 'schedule', 'event', 'webhook', 'email', 'chat', 'form'].includes(kind)) {
          const cron = str(o['cron'], 60);
          if (kind === 'schedule' && !(cron && /^(\S+\s+){4}\S+$/.test(cron))) break;
          ops.push({ op: 'set_trigger', kind, ...(cron ? { cron } : {}), ...(str(o['event'], 60) ? { event: str(o['event'], 60) } : {}) });
          continue;
        }
        break;
      }
      case 'set_model': {
        const model = str(o['model'], 120);
        if (model && ctx.models.some((m) => m.id === model)) { ops.push({ op: 'set_model', model }); continue; }
        break;
      }
      case 'set_retries': {
        const n = Number(o['retries']);
        if (Number.isFinite(n)) { ops.push({ op: 'set_retries', retries: Math.min(Math.max(Math.round(n), 0), 5) }); continue; }
        break;
      }
      case 'insert_approval_before': {
        const nodeIds = (Array.isArray(o['nodeIds']) ? o['nodeIds'] : []).filter((id): id is string => typeof id === 'string' && ids.has(id));
        if (nodeIds.length) { ops.push({ op: 'insert_approval_before', nodeIds }); continue; }
        break;
      }
      case 'remove_approval_before': {
        const nodeIds = (Array.isArray(o['nodeIds']) ? o['nodeIds'] : []).filter((id): id is string => typeof id === 'string' && ids.has(id));
        const toolName = str(o['toolName'], 80);
        ops.push({ op: 'remove_approval_before', ...(nodeIds.length ? { nodeIds } : {}), ...(toolName ? { toolName } : {}) });
        continue;
      }
      case 'set_autonomy': {
        const autonomy = str(o['autonomy'], 40) as 'supervised' | 'semi' | 'autonomous' | undefined;
        if (autonomy && ['supervised', 'semi', 'autonomous'].includes(autonomy)) {
          const level = typeof o['level'] === 'number' && [0, 1, 2, 3, 4].includes(o['level']) ? (o['level'] as AutonomyLevel) : legacyToAutonomyLevel(autonomy);
          ops.push({ op: 'set_autonomy', autonomy, level });
          continue;
        }
        break;
      }
      case 'add_reviewer': {
        const reviewerName = str(o['reviewerName'], 120);
        const instructions = str(o['instructions'], 2_000);
        ops.push({ op: 'add_reviewer', ...(reviewerName ? { reviewerName } : {}), ...(instructions ? { instructions } : {}) });
        continue;
      }
      case 'set_rule': {
        const ruleType = str(o['ruleType'], 40) as 'always' | 'askBefore' | 'never' | undefined;
        const ruleText = str(o['text'], 500);
        if (ruleType && ruleText && ['always', 'askBefore', 'never'].includes(ruleType)) {
          ops.push({ op: 'set_rule', ruleType, text: ruleText });
          continue;
        }
        break;
      }
      case 'attach_knowledge': {
        const kbId = str(o['knowledgeBaseId'], 80);
        const kb = kbId ? ctx.knowledgeBases.find((k) => k.id === kbId) : undefined;
        ops.push({ op: 'attach_knowledge', ...(kb ? { knowledgeBaseId: kb.id, name: kb.name } : {}) });
        continue;
      }
      case 'convert_to_team': {
        const mode = AGENT_DELEGATION_MODES.includes(o['mode'] as AgentDelegationMode) ? (o['mode'] as AgentDelegationMode) : 'router';
        const members = (Array.isArray(o['members']) ? o['members'] : [])
          .map((m) => (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}))
          .map((m) => ({ name: str(m['name'], 80) ?? '', role: str(m['role'], 120) ?? '', instructions: str(m['instructions'], 2_000) ?? '' }))
          .filter((m) => m.name)
          .slice(0, 6);
        ops.push({ op: 'convert_to_team', mode, ...(members.length >= 2 ? { members } : {}) });
        continue;
      }
      case 'merge_steps':
        if (ref('keep') && ref('remove') && o['keep'] !== o['remove']) { ops.push({ op: 'merge_steps', keep: ref('keep')!, remove: ref('remove')! }); continue; }
        break;
    }
    dropped++;
  }
  return { ops, dropped };
}

/* ------------------------------------------------------------ optimize -- */

export interface OptimizationSuggestion {
  id: string;
  title: string;
  detail: string;
  /** Applying it. Absent: advice only. */
  ops?: GraphEditOp[];
  impact: 'cost' | 'speed' | 'reliability' | 'clarity';
}

export interface GraphAnalysis {
  stepCount: number;
  aiCalls: number;
  toolCalls: number;
  approvals: number;
  unreachable: string[];
  suggestions: OptimizationSuggestion[];
}

/**
 * Looks for real waste in a graph: back-to-back AI steps that could be one
 * call, steps nothing reaches, the same tool read twice, reads with no retry.
 * Each suggestion carries the ops that apply it.
 */
export function analyzeStudioGraph(graph: StudioCanvasGraph): GraphAnalysis {
  const path = mainPath(graph);
  const flowEdges = graph.edges.filter(isFlowEdge);
  const reachable = new Set<string>();
  const start = path[0];
  const stack = start ? [start.id] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of graph.edges) if (e.source === id) stack.push(e.target);
  }
  const runnable = graph.nodes.filter((n) => !RUN_TYPES_SKIP.has(n.type));
  const unreachable = runnable.filter((n) => !reachable.has(n.id)).map((n) => n.id);
  const aiCalls = runnable.filter((n) => AGENTIC(n.type) && reachable.has(n.id)).length;
  const toolCalls = runnable.filter((n) => ['MCP_TOOL', 'HTTP_REQUEST', 'FIRECRAWL_SEARCH', 'KB_SEARCH'].includes(n.type) && reachable.has(n.id)).length;
  const suggestions: OptimizationSuggestion[] = [];

  // Back-to-back AI steps, nothing between them and no branch: one call can do both.
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (!(['AGENT', 'AI_CHAT_MODEL', 'LLM', 'AI_SUMMARIZER'].includes(a.type) && ['AGENT', 'AI_CHAT_MODEL', 'LLM', 'AI_SUMMARIZER'].includes(b.type))) continue;
    if (flowEdges.filter((e) => e.source === a.id).length !== 1) continue;
    if (graph.edges.some((e) => e.source === b.id && e.sourceHandle && SLOT_HANDLES.has(e.sourceHandle))) continue;
    suggestions.push({
      id: `merge_${a.id}_${b.id}`,
      title: `Merge “${nodeLabel(a)}” and “${nodeLabel(b)}”`,
      detail: 'They run one after the other with nothing in between, so one AI call can do both — one less model call per run, same result.',
      ops: [{ op: 'merge_steps', keep: a.id, remove: b.id }],
      impact: 'cost',
    });
    i++;
  }

  // The same tool with the same input, twice.
  const seenTools = new Map<string, StudioCanvasNode>();
  for (const n of path) {
    if (n.type !== 'MCP_TOOL') continue;
    const key = `${String(n.data.config?.['toolName'] ?? '')}|${stableStringify(n.data.config?.['input'] ?? '')}`;
    if (!String(n.data.config?.['toolName'] ?? '')) continue;
    const first = seenTools.get(key);
    if (first) {
      suggestions.push({ id: `dupe_${n.id}`, title: `“${nodeLabel(n)}” repeats “${nodeLabel(first)}”`, detail: 'It reads exactly the same thing again. Removing it saves a call; later steps can use the first result.', ops: [{ op: 'remove_step', nodeId: n.id }], impact: 'speed' });
    } else seenTools.set(key, n);
  }

  if (unreachable.length) {
    suggestions.push({
      id: 'unreachable',
      title: `${unreachable.length} step${unreachable.length === 1 ? '' : 's'} never run${unreachable.length === 1 ? 's' : ''}`,
      detail: 'Nothing connects to them from the trigger. Remove them, or wire them in.',
      ops: unreachable.map((nodeId) => ({ op: 'remove_step' as const, nodeId })),
      impact: 'clarity',
    });
  }

  const fragileReads = path.filter((n) => ['MCP_TOOL', 'HTTP_REQUEST', 'KB_SEARCH', 'FIRECRAWL_SEARCH'].includes(n.type) && !(Number(n.data.config?.['retries'] ?? 0) > 0) && !OUTWARD_NODE(n));
  if (fragileReads.length) {
    suggestions.push({
      id: 'retry_reads',
      title: 'Retry reads on a temporary failure',
      detail: `${fragileReads.length} read step${fragileReads.length === 1 ? '' : 's'} give up on the first hiccup. Reads are safe to retry.`,
      ops: [{ op: 'set_retries', retries: 2, nodeIds: fragileReads.map((n) => n.id) }],
      impact: 'reliability',
    });
  }

  return { stepCount: runnable.length, aiCalls, toolCalls, approvals: runnable.filter((n) => isApproval(n.type)).length, unreachable, suggestions };
}

/** Next things worth doing with an agent, given what it has — contextual, a few at a time (brief §10). */
export function suggestNextActions(graph: StudioCanvasGraph, ctx: { hasRuns: boolean; lastRunFailed?: boolean; knowledgeBases: number }): string[] {
  const types = new Set(graph.nodes.map((n) => n.type));
  const out: string[] = [];
  if (ctx.lastRunFailed) out.push('Why did the last run fail?');
  if (graph.nodes.some((n) => n.data?.config?.['needsConnection'])) out.push('What do I still need to connect?');
  if (!ctx.hasRuns) out.push('Run a test');
  if (!types.has('USER_APPROVAL') && graph.nodes.some(OUTWARD_NODE)) out.push('Add human approval before sending');
  if (!types.has('KB_SEARCH') && ctx.knowledgeBases > 0) out.push('Use our company knowledge base');
  if (!graph.nodes.some((n) => /^TRIGGER_SCHEDULE$/.test(n.type))) out.push('Run it every weekday at 9 AM');
  if (!graph.nodes.some((n) => Number(n.data?.config?.['retries'] ?? 0) >= 2)) out.push('Retry failed app calls 3 times');
  if (graph.nodes.filter((n) => AGENTIC(n.type)).length >= 2 && !types.has('AGENT_COORDINATOR')) out.push('Turn this into a multi-agent system');
  out.push('Make this workflow faster', 'Explain how this works');
  return out.slice(0, 5);
}

/* ------------------------------------------------------------ API shapes -- */

/** `POST …/agent-architect/understand` */
export interface ArchitectUnderstandResult {
  spec: AgentArchitectSpec;
  /** The workflow the spec builds, for the preview. */
  graph: StudioCanvasGraph;
  /** `Trigger → Read → Write → Send` (brief §37). */
  flow: string;
  issues: Array<{ nodeId?: string; level: 'error' | 'warning'; message: string }>;
  plannedBy: 'ai' | 'template';
  model?: string;
  durationMs: number;
}

/** `POST …/agent-architect/edit` — a proposal; nothing is saved until it is applied. */
export interface ArchitectEditResult {
  graph: StudioCanvasGraph;
  ops: GraphEditOp[];
  explanation: string;
  notes: string[];
  /** What actually changed, computed from the two graphs. */
  changes: string[];
  changedAnything: boolean;
  issues: Array<{ nodeId?: string; level: 'error' | 'warning'; message: string }>;
  flow: string;
  /** Who worked out the change: fixed rules (instant) or a model. */
  by: 'rules' | 'ai' | 'none';
  model?: string;
}

export interface ArchitectDiagnosisFinding {
  nodeId?: string;
  step: string;
  /** A run failure class (`MISSING_CONNECTION`, `TIMEOUT`…) or `GRAPH` for a canvas problem. */
  code: string;
  message: string;
  hint: string;
  retryable: boolean;
  /** An app to (re)connect, when that is the fix. */
  connect?: string;
}

/** `POST …/agent-architect/:agentId/diagnose` */
export interface ArchitectDiagnosisResult {
  runId: string | null;
  status: string | null;
  summary: string;
  findings: ArchitectDiagnosisFinding[];
  /** Changes that would fix (or harden against) what went wrong. */
  ops: GraphEditOp[];
  /** Whether re-running as-is could succeed. */
  retrySafe: boolean;
}

/** `POST …/agent-architect/:agentId/optimize` */
export interface ArchitectOptimizeResult extends GraphAnalysis {
  runs: { count: number; failureRate: number | null; avgLatencyMs: number | null; avgTokens: number | null; avgCost: number | null };
}

/** `GET|POST …/agent-graphs/:agentId/activation` */
export interface CanvasAgentActivation {
  active: boolean;
  schedule: { cron: string; timezone: string | null } | null;
  /** The app event that starts it, and how watching it is going. */
  appTrigger?: {
    provider: string;
    triggerId: string;
    label: string;
    lastPolledAt: string | null;
    lastFiredAt: string | null;
    lastError: string | null;
  } | null;
}
