import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const SYSTEM_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'SYSTEM_ANNOUNCEMENT',
    name: 'Important Platform Announcement',
    category: 'SYSTEM',
    description: 'Crucial operational or infrastructure announcement to all users (transactional, not marketing).',
    subject: 'Important Update: {{announcement.title}}',
    previewText: '{{announcement.snippet || "Important operational update."}}',
    htmlBody: `
      ${EmailHeading('{{announcement.title}}')}
      ${EmailText('{{announcement.body}}')}
      ${EmailButton('Read Full Details', '{{announcement.url || "http://localhost:4200"}}')}
    `,
    textBody: `Important Update: {{announcement.title}}\n\n{{announcement.body}}\n\nDetails: {{announcement.url}}`,
    variablesSchema: {
      variables: [
        { name: 'announcement.title', type: 'string', description: 'Title', sampleValue: 'API v2 Upgrade Window' },
        { name: 'announcement.body', type: 'string', description: 'Body text', sampleValue: 'We are modernizing our WebSocket protocol next Tuesday.' },
      ],
      samplePayload: { announcement: { title: 'API v2 Upgrade Window', body: 'We are modernizing our WebSocket protocol next Tuesday.', url: 'https://status.onetab.ai' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_SCHEDULED_MAINTENANCE',
    name: 'Scheduled Maintenance Notice',
    category: 'SYSTEM',
    description: 'Advance notice regarding planned infrastructure maintenance window.',
    subject: 'Notice: Scheduled Maintenance on {{maintenance.date}}',
    previewText: 'Planned maintenance window on {{maintenance.date}}.',
    htmlBody: `
      ${EmailHeading('Scheduled Maintenance Notice 🛠️')}
      ${EmailAlert('We have scheduled routine maintenance on {{maintenance.date}} between {{maintenance.startTime}} and {{maintenance.endTime}} ({{maintenance.timezone || "UTC"}}).', 'info')}
      ${EmailText('Expected impact: <strong>{{maintenance.impact || "Brief intermittent connectivity to real-time chat."}}</strong>')}
      ${EmailButton('View Status Page', '{{statusUrl || "https://status.onetab.ai"}}')}
    `,
    textBody: `Scheduled Maintenance: {{maintenance.date}} ({{maintenance.startTime}} - {{maintenance.endTime}})\nImpact: {{maintenance.impact}}\n\nStatus: {{statusUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'maintenance.date', type: 'string', description: 'Date', sampleValue: 'Saturday, Oct 24, 2026' },
        { name: 'maintenance.startTime', type: 'string', description: 'Start time', sampleValue: '02:00 UTC' },
        { name: 'maintenance.endTime', type: 'string', description: 'End time', sampleValue: '04:00 UTC' },
      ],
      samplePayload: { maintenance: { date: 'Saturday, Oct 24, 2026', startTime: '02:00 UTC', endTime: '04:00 UTC', impact: 'Brief intermittent connectivity' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_SERVICE_INTERRUPTION',
    name: 'Service Interruption Alert',
    category: 'SYSTEM',
    description: 'Live incident alert during an active degradation or outage.',
    subject: 'Service Alert: Investigating degraded performance',
    previewText: 'We are investigating an issue affecting {{serviceName || "platform services"}}.',
    htmlBody: `
      ${EmailHeading('Service Interruption Alert ⚠️')}
      ${EmailAlert('We are currently investigating degraded performance affecting {{serviceName || "certain core services"}}.', 'danger')}
      ${EmailText('Incident details: {{incident.summary || "Our engineering team is actively working on restoring full operational capacity."}}')}
      ${EmailButton('Live Incident Updates', '{{statusUrl || "https://status.onetab.ai"}}', { color: '#dc2626' })}
    `,
    textBody: `Service Alert: Investigating degraded performance.\nDetails: {{incident.summary}}\n\nLive updates: {{statusUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'serviceName', type: 'string', description: 'Affected service', sampleValue: 'AI Agent Execution Engine' },
        { name: 'incident.summary', type: 'string', description: 'Summary', sampleValue: 'Database failover in progress.' },
      ],
      samplePayload: { serviceName: 'AI Agent Engine', incident: { summary: 'Failover in progress' }, statusUrl: 'https://status.onetab.ai' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_SERVICE_RESTORED',
    name: 'Service Restored',
    category: 'SYSTEM',
    description: 'Incident resolution confirmation notice.',
    subject: 'Service Restored: All systems fully operational',
    previewText: 'All services have returned to normal operation.',
    htmlBody: `
      ${EmailHeading('Service Restored ✅')}
      ${EmailAlert('The earlier incident affecting {{serviceName || "services"}} has been resolved. All platform components are operating normally.', 'success')}
      ${EmailButton('View Post-Mortem / Status', '{{statusUrl || "https://status.onetab.ai"}}')}
    `,
    textBody: `Service Restored: All systems fully operational.\n\nStatus: {{statusUrl}}`,
    variablesSchema: {
      variables: [{ name: 'serviceName', type: 'string', description: 'Service', sampleValue: 'AI Agent Engine' }],
      samplePayload: { serviceName: 'AI Agent Engine', statusUrl: 'https://status.onetab.ai' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_TERMS_UPDATE',
    name: 'Terms of Service Update',
    category: 'SYSTEM',
    description: 'Mandatory compliance update informing users of updated Terms of Service.',
    subject: 'Important: Updates to our Terms of Service',
    previewText: 'Please review our updated Terms of Service.',
    htmlBody: `
      ${EmailHeading('Terms of Service Update')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We are writing to let you know that we have updated our <strong>Terms of Service</strong>, effective {{formatDate effectiveDate}}.')}
      ${EmailText('Summary of changes: {{terms.summary || "Updates clarify enterprise AI licensing, data retention, and mutual liability."}}')}
      ${EmailButton('Review Updated Terms', '{{terms.url || "http://localhost:4200/legal/terms"}}')}
    `,
    textBody: `Important: Updates to our Terms of Service (effective {{formatDate effectiveDate}}).\n\nReview: {{terms.url}}`,
    variablesSchema: {
      variables: [
        { name: 'effectiveDate', type: 'date', description: 'Effective date', sampleValue: '2026-11-01T00:00:00Z' },
        { name: 'terms.summary', type: 'string', description: 'Summary', sampleValue: 'Clarifications on enterprise AI usage.' },
      ],
      samplePayload: { effectiveDate: '2026-11-01T00:00:00Z', terms: { summary: 'Clarifications on enterprise AI usage.', url: 'https://onetab.ai/terms' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_PRIVACY_UPDATE',
    name: 'Privacy Policy Update',
    category: 'SYSTEM',
    description: 'Mandatory compliance notice informing users of Privacy Policy revisions.',
    subject: 'Important: Updates to our Privacy Policy',
    previewText: 'We have updated our Privacy Policy.',
    htmlBody: `
      ${EmailHeading('Privacy Policy Update')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We have updated our <strong>Privacy Policy</strong> to provide enhanced transparency regarding how your data is processed and protected.')}
      ${EmailText('Effective date: <strong>{{formatDate effectiveDate}}</strong>.')}
      ${EmailButton('Read Privacy Policy', '{{privacy.url || "http://localhost:4200/legal/privacy"}}')}
    `,
    textBody: `Important: Updates to our Privacy Policy (effective {{formatDate effectiveDate}}).\n\nRead: {{privacy.url}}`,
    variablesSchema: {
      variables: [{ name: 'effectiveDate', type: 'date', description: 'Date', sampleValue: '2026-11-01T00:00:00Z' }],
      samplePayload: { effectiveDate: '2026-11-01T00:00:00Z', privacy: { url: 'https://onetab.ai/privacy' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SYSTEM_COMPLIANCE_NOTIFICATION',
    name: 'Compliance & Audit Notification',
    category: 'SYSTEM',
    description: 'Notice concerning regulatory, GDPR, SOC2 or security audit findings.',
    subject: 'Compliance Notice: {{compliance.title}}',
    previewText: 'Required compliance update for your workspace.',
    htmlBody: `
      ${EmailHeading('Compliance & Security Notice')}
      ${EmailAlert('{{compliance.title}}: {{compliance.description || "A compliance verification or regulatory event requires administrative acknowledgement."}}', 'info')}
      ${EmailButton('View Compliance Center', '{{compliance.url || "http://localhost:4200/compliance"}}')}
    `,
    textBody: `Compliance Notice: {{compliance.title}}.\n\nDetails: {{compliance.url}}`,
    variablesSchema: {
      variables: [
        { name: 'compliance.title', type: 'string', description: 'Title', sampleValue: 'Annual SOC 2 Type II Report Available' },
        { name: 'compliance.url', type: 'url', description: 'URL' },
      ],
      samplePayload: { compliance: { title: 'Annual SOC 2 Type II Report Available', url: 'https://app.onetab.ai/compliance' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
