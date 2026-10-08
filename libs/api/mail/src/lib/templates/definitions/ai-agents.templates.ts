import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const AI_AGENTS_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'AGENT_CREATED',
    name: 'AI Agent Created',
    category: 'AI_AGENTS',
    description: 'Notification when a new autonomous agent is configured.',
    subject: 'New AI Agent created: {{agent.name}}',
    previewText: '{{agent.name}} was created in AI Agent Studio.',
    htmlBody: `
      ${EmailHeading('Agent Created')}
      ${EmailText('A new AI agent <strong>{{agent.name}}</strong> has been configured in <strong>{{workspace.name}}</strong>.')}
      ${EmailCard([
        { label: 'Agent', value: '{{agent.name}}' },
        { label: 'Objective', value: '{{agent.description || "Autonomous workflow assistant"}}' },
        { label: 'Status', value: '{{agent.status || "Draft"}}' },
      ])}
      ${EmailButton('Configure Agent', '{{agent.url || "http://localhost:4200"}}')}
    `,
    textBody: `New AI Agent created: {{agent.name}}\n\nConfigure: {{agent.url}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Support Triage Bot' },
        { name: 'agent.url', type: 'url', description: 'Agent Studio URL' },
      ],
      samplePayload: { agent: { name: 'Support Triage Bot', status: 'Draft', url: 'https://app.onetab.ai/agents/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_PUBLISHED',
    name: 'AI Agent Published',
    category: 'AI_AGENTS',
    description: 'Notice when an agent is deployed to production / channels.',
    subject: 'AI Agent published: {{agent.name}}',
    previewText: '{{agent.name}} is now live and responding.',
    htmlBody: `
      ${EmailHeading('Agent Published 🚀')}
      ${EmailAlert('{{agent.name}} has been published and is now active.', 'success')}
      ${EmailButton('View in Studio', '{{agent.url}}')}
    `,
    textBody: `Agent published: {{agent.name}} is live!\n\nView: {{agent.url}}`,
    variablesSchema: {
      variables: [{ name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Support Triage Bot' }],
      samplePayload: { agent: { name: 'Support Triage Bot', url: 'https://app.onetab.ai/agents/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_UNPUBLISHED',
    name: 'AI Agent Unpublished',
    category: 'AI_AGENTS',
    description: 'Alert when an agent is taken offline.',
    subject: 'AI Agent unpublished: {{agent.name}}',
    previewText: '{{agent.name}} was taken offline.',
    htmlBody: `
      ${EmailHeading('Agent Unpublished')}
      ${EmailText('The AI agent <strong>{{agent.name}}</strong> was unpublished and is no longer responding to triggers.')}
    `,
    textBody: `AI Agent unpublished: {{agent.name}}.`,
    variablesSchema: {
      variables: [{ name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Support Triage Bot' }],
      samplePayload: { agent: { name: 'Support Triage Bot' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_EXECUTION_STARTED',
    name: 'Agent Execution Started',
    category: 'AI_AGENTS',
    description: 'Notification for long-running batch agent executions.',
    subject: 'Agent run started: {{agent.name}} (Run #{{agent.runId}})',
    previewText: '{{agent.name}} started executing workflow.',
    htmlBody: `
      ${EmailHeading('Agent Execution Started')}
      ${EmailText('<strong>{{agent.name}}</strong> started executing workflow run <strong>#{{agent.runId}}</strong>.')}
      ${EmailButton('Monitor Live Run', '{{agent.resultUrl || agent.url}}')}
    `,
    textBody: `Agent run started: {{agent.name}} (#{{agent.runId}}).\n\nMonitor: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Data Sync Bot' },
        { name: 'agent.runId', type: 'string', description: 'Run ID', sampleValue: 'run_8471' },
      ],
      samplePayload: { agent: { name: 'Data Sync Bot', runId: 'run_8471', resultUrl: 'https://app.onetab.ai/agents/runs/8471' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_EXECUTION_COMPLETED',
    name: 'Agent Execution Completed',
    category: 'AI_AGENTS',
    description: 'Sent when an agent finishes an execution run successfully.',
    subject: 'Agent run completed successfully: {{agent.name}}',
    previewText: '{{agent.name}} finished run #{{agent.runId}}.',
    htmlBody: `
      ${EmailHeading('Agent Execution Completed ✅')}
      ${EmailAlert('{{agent.name}} finished executing run #{{agent.runId}} successfully.', 'success')}
      ${EmailCard([
        { label: 'Agent', value: '{{agent.name}}' },
        { label: 'Run ID', value: '{{agent.runId}}' },
        { label: 'Status', value: 'COMPLETED' },
      ])}
      ${EmailButton('View Output & Results', '{{agent.resultUrl}}')}
    `,
    textBody: `Agent run completed: {{agent.name}} (#{{agent.runId}}).\n\nView results: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Data Sync Bot' },
        { name: 'agent.runId', type: 'string', description: 'Run ID', sampleValue: 'run_8471' },
        { name: 'agent.resultUrl', type: 'url', description: 'Output URL' },
      ],
      samplePayload: { agent: { name: 'Data Sync Bot', runId: 'run_8471', resultUrl: 'https://app.onetab.ai/agents/runs/8471' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_EXECUTION_FAILED',
    name: 'Agent Execution Failed',
    category: 'AI_AGENTS',
    description: 'High-priority alert when an agent workflow errors or crashes.',
    subject: 'ALERT: Agent execution failed for {{agent.name}}',
    previewText: '{{agent.name}} encountered an error on run #{{agent.runId}}.',
    htmlBody: `
      ${EmailHeading('Agent Execution Failed ⚠️')}
      ${EmailAlert('Run #{{agent.runId}} failed with error: {{agent.errorMessage || "Execution terminated unexpectedly."}}', 'danger')}
      ${EmailCard([
        { label: 'Agent', value: '{{agent.name}}' },
        { label: 'Run ID', value: '{{agent.runId}}' },
        { label: 'Error', value: '{{agent.errorMessage || "Unknown error"}}' },
      ])}
      ${EmailButton('Inspect Logs & Retry', '{{agent.resultUrl}}', { color: '#dc2626' })}
    `,
    textBody: `ALERT: Agent run failed: {{agent.name}} (#{{agent.runId}}).\nError: {{agent.errorMessage}}\n\nInspect: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Data Sync Bot' },
        { name: 'agent.runId', type: 'string', description: 'Run ID', sampleValue: 'run_8471' },
        { name: 'agent.errorMessage', type: 'string', description: 'Error message', sampleValue: 'API rate limit exceeded on upstream CRM' },
      ],
      samplePayload: { agent: { name: 'Data Sync Bot', runId: 'run_8471', errorMessage: 'Upstream rate limit', resultUrl: 'https://app.onetab.ai/agents/runs/8471' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_REQUIRES_INPUT',
    name: 'Agent Requires User Input',
    category: 'AI_AGENTS',
    description: 'Sent when an agent workflow pauses waiting for clarification or prompt input.',
    subject: 'Input required: {{agent.name}} needs your input to continue',
    previewText: '{{agent.name}} is waiting for your response.',
    htmlBody: `
      ${EmailHeading('Agent waiting for your input')}
      ${EmailAlert('{{agent.name}} paused its run and requires human guidance to proceed.', 'info')}
      ${EmailText('Question / Prompt: <strong>"{{agent.promptMessage || "Clarification needed"}}"</strong>')}
      ${EmailButton('Provide Input', '{{agent.inputUrl || agent.resultUrl}}')}
    `,
    textBody: `Input required: {{agent.name}} needs your input.\nPrompt: {{agent.promptMessage}}\n\nProvide input: {{agent.inputUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Customer Researcher' },
        { name: 'agent.promptMessage', type: 'string', description: 'Prompt text', sampleValue: 'Please specify target market region' },
      ],
      samplePayload: { agent: { name: 'Customer Researcher', promptMessage: 'Please specify target market region', inputUrl: 'https://app.onetab.ai/agents/runs/1/input' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_APPROVAL_REQUIRED',
    name: 'Agent Requires Human Approval',
    category: 'AI_AGENTS',
    description: 'Security & policy gate: sent when an agent proposes an action needing manager sign-off.',
    subject: 'Approval Required: {{agent.name}} requested action approval',
    previewText: '{{agent.name}} is requesting sign-off to execute {{action.name}}.',
    htmlBody: `
      ${EmailHeading('Approval Required')}
      ${EmailAlert('{{agent.name}} requires manager authorization before executing this action.', 'warning')}
      ${EmailCard([
        { label: 'Agent', value: '{{agent.name}}' },
        { label: 'Action Proposed', value: '{{action.name || "External API Call"}}' },
        { label: 'Details', value: '{{action.details || "Dispatched outbound transactional batch"}}' },
      ])}
      ${EmailButton('Review & Approve', '{{approval.url}}')}
    `,
    textBody: `Approval Required: {{agent.name}} requested sign-off.\nAction: {{action.name}}\n\nReview & Approve: {{approval.url}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent name', sampleValue: 'Billing Reconciler' },
        { name: 'action.name', type: 'string', description: 'Action name', sampleValue: 'Issue $450 customer refund' },
        { name: 'approval.url', type: 'url', description: 'Approval link' },
      ],
      samplePayload: { agent: { name: 'Billing Reconciler' }, action: { name: 'Issue $450 refund' }, approval: { url: 'https://app.onetab.ai/approvals/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_APPROVAL_COMPLETED',
    name: 'Agent Approval Completed',
    category: 'AI_AGENTS',
    description: 'Notice when an approval was decided by a manager.',
    subject: 'Agent approval decided: {{decision || "Approved"}} for {{agent.name}}',
    previewText: '{{decision}} by {{approver.name}}.',
    htmlBody: `
      ${EmailHeading('Approval Decided')}
      ${EmailText('The action requested by <strong>{{agent.name}}</strong> was <strong>{{decision || "Approved"}}</strong> by {{approver.name}}.')}
      ${EmailButton('View Run Status', '{{agent.resultUrl}}')}
    `,
    textBody: `Agent action was {{decision}} by {{approver.name}} for {{agent.name}}.\n\nView: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Billing Reconciler' },
        { name: 'decision', type: 'string', description: 'Decision (Approved/Rejected)', sampleValue: 'Approved' },
        { name: 'approver.name', type: 'string', description: 'Approver', sampleValue: 'Alex' },
      ],
      samplePayload: { agent: { name: 'Billing Reconciler', resultUrl: 'https://app.onetab.ai/agents/runs/1' }, decision: 'Approved', approver: { name: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_WORKFLOW_COMPLETED',
    name: 'Agent Workflow Completed',
    category: 'AI_AGENTS',
    description: 'Notification when an entire multi-step workflow completes.',
    subject: 'Workflow completed: {{workflow.name}}',
    previewText: 'All steps in {{workflow.name}} executed successfully.',
    htmlBody: `
      ${EmailHeading('Workflow Completed 🎉')}
      ${EmailAlert('Workflow "{{workflow.name}}" has finished all steps.', 'success')}
      ${EmailButton('View Workflow Summary', '{{workflow.url || agent.resultUrl}}')}
    `,
    textBody: `Workflow completed: {{workflow.name}}!\n\nView: {{workflow.url}}`,
    variablesSchema: {
      variables: [{ name: 'workflow.name', type: 'string', description: 'Workflow name', sampleValue: 'Nightly Sync & Report' }],
      samplePayload: { workflow: { name: 'Nightly Sync & Report', url: 'https://app.onetab.ai/workflows/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_WORKFLOW_FAILED',
    name: 'Agent Workflow Failed',
    category: 'AI_AGENTS',
    description: 'Alert when a multi-agent workflow encounters a critical failure.',
    subject: 'Workflow failed: {{workflow.name}}',
    previewText: 'Error occurred in workflow {{workflow.name}}.',
    htmlBody: `
      ${EmailHeading('Workflow Failed ❌')}
      ${EmailAlert('Workflow "{{workflow.name}}" failed at step: {{failedStep || "Step execution"}}.', 'danger')}
      ${EmailButton('Debug Workflow', '{{workflow.url}}', { color: '#dc2626' })}
    `,
    textBody: `Workflow failed: {{workflow.name}} at step: {{failedStep}}.\n\nDebug: {{workflow.url}}`,
    variablesSchema: {
      variables: [
        { name: 'workflow.name', type: 'string', description: 'Workflow name', sampleValue: 'Nightly Sync' },
        { name: 'failedStep', type: 'string', description: 'Step name', sampleValue: 'Generate PDF Report' },
      ],
      samplePayload: { workflow: { name: 'Nightly Sync', url: 'https://app.onetab.ai/workflows/1' }, failedStep: 'Generate PDF Report' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_WORKFLOW_PAUSED',
    name: 'Agent Workflow Paused',
    category: 'AI_AGENTS',
    description: 'Notice when a workflow is paused due to concurrency limits or errors.',
    subject: 'Workflow paused: {{workflow.name}}',
    previewText: '{{workflow.name}} is currently paused.',
    htmlBody: `
      ${EmailHeading('Workflow Paused')}
      ${EmailAlert('Workflow "{{workflow.name}}" was paused. Reason: {{pauseReason || "Rate limit or manual pause"}}', 'warning')}
      ${EmailButton('Resume Workflow', '{{workflow.url}}')}
    `,
    textBody: `Workflow paused: {{workflow.name}}.\nReason: {{pauseReason}}\n\nResume: {{workflow.url}}`,
    variablesSchema: {
      variables: [{ name: 'workflow.name', type: 'string', description: 'Workflow name', sampleValue: 'Crawler Pipeline' }],
      samplePayload: { workflow: { name: 'Crawler Pipeline', url: 'https://app.onetab.ai/workflows/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_HANDOFF_HUMAN',
    name: 'Agent Handoff to Human Operator',
    category: 'AI_AGENTS',
    description: 'Triggered when an autonomous AI agent reaches confidence threshold and hands off to human.',
    subject: 'Agent Handoff: {{agent.name}} requires human operator takeover',
    previewText: 'Immediate handoff requested for {{conversation.subject || "conversation"}}.',
    htmlBody: `
      ${EmailHeading('Human Handoff Triggered')}
      ${EmailAlert('{{agent.name}} escalated this session to a human team member.', 'warning')}
      ${EmailText('Reason: {{handoffReason || "Customer requested human or low model confidence."}}')}
      ${EmailButton('Take Over Conversation', '{{handoffUrl || agent.resultUrl}}')}
    `,
    textBody: `Human Handoff Triggered: {{agent.name}}\nReason: {{handoffReason}}\n\nTake over: {{handoffUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Support Agent' },
        { name: 'handoffReason', type: 'string', description: 'Reason', sampleValue: 'Customer requested human agent' },
      ],
      samplePayload: { agent: { name: 'Support Agent' }, handoffReason: 'Customer requested human agent', handoffUrl: 'https://app.onetab.ai/inbox/1' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_SCHEDULED_EXECUTION',
    name: 'Scheduled Agent Execution Triggered',
    category: 'AI_AGENTS',
    description: 'Summary of cron-scheduled agent run.',
    subject: 'Scheduled execution triggered: {{agent.name}}',
    previewText: 'Scheduled run #{{agent.runId}} started.',
    htmlBody: `
      ${EmailHeading('Scheduled Run Started')}
      ${EmailText('Your cron scheduled agent <strong>{{agent.name}}</strong> triggered automatically.')}
      ${EmailButton('Monitor Run', '{{agent.resultUrl}}')}
    `,
    textBody: `Scheduled run started for {{agent.name}}.\n\nMonitor: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [{ name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Weekly Digest Bot' }],
      samplePayload: { agent: { name: 'Weekly Digest Bot', resultUrl: 'https://app.onetab.ai/agents/runs/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_RESULT_AVAILABLE',
    name: 'Agent Result Available',
    category: 'AI_AGENTS',
    description: 'Dispatches synthesized output of an agent.',
    subject: 'Agent output ready: {{agent.name}}',
    previewText: 'View output from {{agent.name}}.',
    htmlBody: `
      ${EmailHeading('Agent Output Ready')}
      ${EmailText('<strong>{{agent.name}}</strong> has finished processing and generated output.')}
      ${EmailButton('View Output', '{{agent.resultUrl}}')}
    `,
    textBody: `Agent output ready for {{agent.name}}.\n\nView: {{agent.resultUrl}}`,
    variablesSchema: {
      variables: [{ name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Market Researcher' }],
      samplePayload: { agent: { name: 'Market Researcher', resultUrl: 'https://app.onetab.ai/agents/results/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_REPORT_AVAILABLE',
    name: 'Agent Research Report Available',
    category: 'AI_AGENTS',
    description: 'Delivers synthesized multi-page research report generated by agent.',
    subject: 'Report generated: {{report.title || agent.name}}',
    previewText: 'Your comprehensive report is ready.',
    htmlBody: `
      ${EmailHeading('Research Report Ready 📊')}
      ${EmailText('{{agent.name}} has compiled your report: <strong>{{report.title || "Research Report"}}</strong>.')}
      ${EmailButton('Download Report', '{{report.url || agent.resultUrl}}')}
    `,
    textBody: `Report ready: {{report.title || agent.name}}.\n\nDownload: {{report.url}}`,
    variablesSchema: {
      variables: [
        { name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Analyst Bot' },
        { name: 'report.title', type: 'string', description: 'Report title', sampleValue: 'Q3 Competitor Landscape' },
      ],
      samplePayload: { agent: { name: 'Analyst Bot' }, report: { title: 'Q3 Competitor Landscape', url: 'https://app.onetab.ai/reports/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_KNOWLEDGE_INGESTION_COMPLETED',
    name: 'Knowledge Ingestion Completed',
    category: 'AI_AGENTS',
    description: 'Sent when documents/vectors finish vectorization.',
    subject: 'Knowledge ingestion complete: {{knowledgeBase.name}}',
    previewText: '{{documentCount || "Documents"}} indexed into knowledge base.',
    htmlBody: `
      ${EmailHeading('Knowledge Ingestion Complete')}
      ${EmailAlert('Vectorization complete for {{knowledgeBase.name}}. Your agents can now ground against this dataset.', 'success')}
      ${EmailButton('View Knowledge Base', '{{knowledgeBase.url || "http://localhost:4200"}}')}
    `,
    textBody: `Knowledge ingestion complete for {{knowledgeBase.name}}!\n\nView: {{knowledgeBase.url}}`,
    variablesSchema: {
      variables: [{ name: 'knowledgeBase.name', type: 'string', description: 'KB name', sampleValue: 'Engineering Documentation' }],
      samplePayload: { knowledgeBase: { name: 'Engineering Documentation', url: 'https://app.onetab.ai/knowledge/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_KNOWLEDGE_INGESTION_FAILED',
    name: 'Knowledge Ingestion Failed',
    category: 'AI_AGENTS',
    description: 'Alert when document indexing or embedding fails.',
    subject: 'Knowledge ingestion error: {{knowledgeBase.name}}',
    previewText: 'Failed to process documents into knowledge base.',
    htmlBody: `
      ${EmailHeading('Knowledge Ingestion Failed')}
      ${EmailAlert('Errors occurred while processing files for {{knowledgeBase.name}}: {{errorMessage || "Invalid document structure."}}', 'danger')}
      ${EmailButton('View Error Logs', '{{knowledgeBase.url}}')}
    `,
    textBody: `Knowledge ingestion failed for {{knowledgeBase.name}}.\nError: {{errorMessage}}`,
    variablesSchema: {
      variables: [{ name: 'knowledgeBase.name', type: 'string', description: 'KB name', sampleValue: 'Engineering Docs' }],
      samplePayload: { knowledgeBase: { name: 'Engineering Docs', url: 'https://app.onetab.ai/knowledge/1' }, errorMessage: 'PDF parser failure' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_TOOL_FAILED',
    name: 'Connected Tool Failed',
    category: 'AI_AGENTS',
    description: 'Alert when an agent tool integration (e.g. GitHub, Linear) crashes.',
    subject: 'Tool execution failed: {{tool.name}} in agent {{agent.name}}',
    previewText: '{{tool.name}} failed to execute.',
    htmlBody: `
      ${EmailHeading('Connected Tool Failed')}
      ${EmailAlert('The tool {{tool.name}} failed during agent run: {{errorMessage || "Request failed."}}', 'danger')}
      ${EmailButton('Check Tool Integration', '{{tool.url || agent.url}}')}
    `,
    textBody: `Tool {{tool.name}} failed in agent {{agent.name}}.\nError: {{errorMessage}}`,
    variablesSchema: {
      variables: [
        { name: 'tool.name', type: 'string', description: 'Tool', sampleValue: 'GitHub Issue Creator' },
        { name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'Triage Agent' },
      ],
      samplePayload: { tool: { name: 'GitHub Issue Creator' }, agent: { name: 'Triage Agent' }, errorMessage: 'Bad credentials' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_CREDENTIAL_EXPIRED',
    name: 'API Credential Expired',
    category: 'AI_AGENTS',
    description: 'Alert when an LLM key or OAuth tool credential expires.',
    subject: 'Action Required: API credential expired for {{integration.name}}',
    previewText: 'Your API key or integration token has expired.',
    htmlBody: `
      ${EmailHeading('API Credential Expired ⚠️')}
      ${EmailAlert('The API credentials for {{integration.name}} expired or were rejected. AI agents using this tool cannot function.', 'danger')}
      ${EmailButton('Reconnect API Key', '{{integration.url || "http://localhost:4200/settings"}}')}
    `,
    textBody: `API Credential Expired for {{integration.name}}.\n\nReconnect: {{integration.url}}`,
    variablesSchema: {
      variables: [{ name: 'integration.name', type: 'string', description: 'Integration', sampleValue: 'OpenAI API Key' }],
      samplePayload: { integration: { name: 'OpenAI API Key', url: 'https://app.onetab.ai/settings/integrations' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AGENT_USAGE_LIMIT_REACHED',
    name: 'Agent Usage Limit Reached',
    category: 'AI_AGENTS',
    description: 'Alert when an agent or workspace hits daily LLM token or execution cap.',
    subject: 'Usage Limit Reached: {{agent.name || "AI Agent Studio"}}',
    previewText: 'Your monthly or daily AI execution quota was reached.',
    htmlBody: `
      ${EmailHeading('AI Execution Limit Reached')}
      ${EmailAlert('You have reached 100% of your AI token or execution limit for this billing cycle.', 'warning')}
      ${EmailText('Further agent runs will be queued or paused until the next cycle or upon plan upgrade.')}
      ${EmailButton('Upgrade AI Quota', '{{upgradeUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `AI Execution Limit Reached for {{agent.name || "AI Agent Studio"}}.\n\nUpgrade quota: {{upgradeUrl}}`,
    variablesSchema: {
      variables: [{ name: 'agent.name', type: 'string', description: 'Agent', sampleValue: 'AI Agent Studio' }],
      samplePayload: { agent: { name: 'AI Agent Studio' }, upgradeUrl: 'https://app.onetab.ai/settings/billing' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
