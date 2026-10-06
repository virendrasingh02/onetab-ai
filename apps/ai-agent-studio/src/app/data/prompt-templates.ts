/**
 * Domain templates for "Create with one prompt". A template only fills in
 * the prompt — the Studio still plans it against this workspace's real tools,
 * and everything stays editable.
 */
export interface PromptTemplate {
  id: string;
  domain: 'HR' | 'Sales' | 'Marketing' | 'Finance' | 'Support' | 'Ecommerce';
  title: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: 'hr-screening', domain: 'HR', title: 'Candidate screening', prompt: 'Create an HR agent that reads incoming resumes, compares candidates against our job description, ranks them and creates a shortlist for the hiring manager.' },
  { id: 'hr-onboarding', domain: 'HR', title: 'Employee onboarding', prompt: 'Create an onboarding agent that, when a new employee joins, creates their onboarding tasks, shares the handbook and checks in at the end of the first week.' },
  { id: 'hr-helpdesk', domain: 'HR', title: 'HR helpdesk', prompt: 'Create an HR helpdesk agent that answers employee questions from our HR policies and escalates anything sensitive to a person.' },
  { id: 'sales-followup', domain: 'Sales', title: 'Sales follow-up', prompt: 'Create a sales follow-up agent that checks new CRM leads every weekday at 9 AM, scores lead quality, drafts a personalised follow-up and sends it through Gmail after my approval.' },
  { id: 'sales-meeting-prep', domain: 'Sales', title: 'Meeting prep', prompt: 'Create a meeting prep agent that, every morning, looks at today’s customer meetings and writes a one-page brief for each with context from our docs.' },
  { id: 'sales-pipeline', domain: 'Sales', title: 'Pipeline reporter', prompt: 'Create an agent that sends me a daily sales pipeline report every evening.' },
  { id: 'mkt-campaign', domain: 'Marketing', title: 'Campaign assistant', prompt: 'Create a marketing campaign assistant that drafts campaign briefs and social posts from our brand guidelines and asks for approval before publishing anything.' },
  { id: 'mkt-content', domain: 'Marketing', title: 'Content research', prompt: 'Create a content agent that researches a topic on the web, summarises what competitors are saying and drafts a blog outline as a doc.' },
  { id: 'fin-report', domain: 'Finance', title: 'Daily finance report', prompt: 'Create a daily finance reporting agent that summarises yesterday’s revenue and expenses every morning at 8 and posts it in #finance.' },
  { id: 'fin-invoices', domain: 'Finance', title: 'Invoice follow-up', prompt: 'Create an invoice agent that checks overdue invoices every Monday and drafts polite reminder emails for my approval.' },
  { id: 'sup-agent', domain: 'Support', title: 'Support agent', prompt: 'Create a support agent that reads new tickets, searches our documentation, drafts replies and escalates urgent issues to a person.' },
  { id: 'sup-triage', domain: 'Support', title: 'Ticket triage', prompt: 'Monitor support tickets, classify them by urgency and topic, and escalate urgent issues in #support.' },
  { id: 'eco-carts', domain: 'Ecommerce', title: 'Abandoned carts', prompt: 'Create an ecommerce agent that checks abandoned carts every morning and sends personalised follow-up emails.' },
  { id: 'eco-ops', domain: 'Ecommerce', title: 'Store operations team', prompt: 'Build an ecommerce operations system that handles orders, refunds, customer support and inventory.' },
];

/** Rotating examples under the prompt box. */
export const PROMPT_SUGGESTIONS = [
  'Build a sales follow-up agent',
  'Create an HR recruitment assistant',
  'Monitor support tickets and escalate urgent issues',
  'Create a daily finance reporting agent',
  'Build a marketing campaign assistant',
  'Create an ecommerce order support agent',
];
