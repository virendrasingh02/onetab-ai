import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const MESSAGING_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'MSG_DIRECT_MESSAGE',
    name: 'New Direct Message',
    category: 'MESSAGING',
    description: 'Notification when someone sends you a 1:1 direct message.',
    subject: 'New message from {{sender.name}}',
    previewText: '"{{message.snippet}}"',
    htmlBody: `
      ${EmailHeading('New Direct Message')}
      ${EmailText('<strong>{{sender.name}}</strong> sent you a direct message in {{workspace.name}}:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{message.snippet}}
      </div>
      ${EmailButton('Reply', '{{message.url || "http://localhost:4200"}}')}
    `,
    textBody: `New direct message from {{sender.name}}:\n\n"{{message.snippet}}"\n\nReply: {{message.url}}`,
    variablesSchema: {
      variables: [
        { name: 'sender.name', type: 'string', description: 'Sender name', sampleValue: 'Alex' },
        { name: 'message.snippet', type: 'string', description: 'Message snippet', sampleValue: 'Hey, are you free for a quick sync?' },
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { sender: { name: 'Alex' }, message: { snippet: 'Hey, are you free for a quick sync?' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_CHANNEL_MENTION',
    name: 'Mention in Channel',
    category: 'MESSAGING',
    description: 'Notification when tagged in a channel.',
    subject: '{{sender.name}} mentioned you in #{{channel.name}}',
    previewText: '"{{message.snippet}}"',
    htmlBody: `
      ${EmailHeading('Mentioned in #{{channel.name}}')}
      ${EmailText('<strong>{{sender.name}}</strong> mentioned you in <strong>#{{channel.name}}</strong>:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{message.snippet}}
      </div>
      ${EmailButton('View Message', '{{message.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{sender.name}} mentioned you in #{{channel.name}}:\n\n"{{message.snippet}}"\n\nView: {{message.url}}`,
    variablesSchema: {
      variables: [
        { name: 'sender.name', type: 'string', description: 'Sender', sampleValue: 'Sarah' },
        { name: 'channel.name', type: 'string', description: 'Channel', sampleValue: 'engineering' },
        { name: 'message.snippet', type: 'string', description: 'Message', sampleValue: '@Alex could you review the PR?' },
      ],
      samplePayload: { sender: { name: 'Sarah' }, channel: { name: 'engineering' }, message: { snippet: '@Alex review PR' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_CHANNEL_INVITATION',
    name: 'Channel Invitation',
    category: 'MESSAGING',
    description: 'Notice when invited to join a channel.',
    subject: 'You were invited to #{{channel.name}}',
    previewText: '{{inviter.name}} invited you to #{{channel.name}}.',
    htmlBody: `
      ${EmailHeading('Channel Invitation')}
      ${EmailText('<strong>{{inviter.name}}</strong> invited you to join <strong>#{{channel.name}}</strong>.')}
      ${EmailButton('Join Channel', '{{channel.url || "http://localhost:4200"}}')}
    `,
    textBody: `You were invited to #{{channel.name}} by {{inviter.name}}.\n\nJoin: {{channel.url}}`,
    variablesSchema: {
      variables: [
        { name: 'inviter.name', type: 'string', description: 'Inviter', sampleValue: 'Alex' },
        { name: 'channel.name', type: 'string', description: 'Channel', sampleValue: 'ai-agents' },
      ],
      samplePayload: { inviter: { name: 'Alex' }, channel: { name: 'ai-agents' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_NOTIFICATION',
    name: 'General Message Notification',
    category: 'MESSAGING',
    description: 'Notification for high-priority channel broadcast (@channel, @everyone).',
    subject: 'Announcement in #{{channel.name}} by {{sender.name}}',
    previewText: 'Important broadcast in #{{channel.name}}.',
    htmlBody: `
      ${EmailHeading('Announcement in #{{channel.name}}')}
      ${EmailText('<strong>{{sender.name}}</strong> posted an announcement:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #f59e0b; font-size: 13px;">
        {{message.snippet}}
      </div>
      ${EmailButton('View Announcement', '{{message.url || "http://localhost:4200"}}')}
    `,
    textBody: `Announcement in #{{channel.name}} by {{sender.name}}:\n\n"{{message.snippet}}"\n\nView: {{message.url}}`,
    variablesSchema: {
      variables: [
        { name: 'sender.name', type: 'string', description: 'Sender', sampleValue: 'Leadership' },
        { name: 'channel.name', type: 'string', description: 'Channel', sampleValue: 'announcements' },
        { name: 'message.snippet', type: 'string', description: 'Text', sampleValue: 'All hands meeting at 2pm.' },
      ],
      samplePayload: { sender: { name: 'Leadership' }, channel: { name: 'announcements' }, message: { snippet: 'All hands at 2pm' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_UNREAD_REMINDER',
    name: 'Unread Message Digest Reminder',
    category: 'MESSAGING',
    description: 'Periodic digest of unread direct messages and mentions while offline.',
    subject: 'You have {{unreadCount || "several"}} unread messages in {{workspace.name}}',
    previewText: 'Catch up on messages from {{senderNames || "your team"}}.',
    htmlBody: `
      ${EmailHeading('Catch up on unread messages')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('You have <strong>{{unreadCount || "several"}} unread messages</strong> waiting for you in <strong>{{workspace.name}}</strong>.')}
      ${EmailButton('Open Inbox', '{{inboxUrl || "http://localhost:4200"}}')}
    `,
    textBody: `You have {{unreadCount || "several"}} unread messages in {{workspace.name}}.\n\nOpen inbox: {{inboxUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'unreadCount', type: 'number', description: 'Count', sampleValue: 5 },
        { name: 'workspace.name', type: 'string', description: 'Workspace', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { unreadCount: 5, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_INBOX_ASSIGNED',
    name: 'Inbox Conversation Assigned',
    category: 'MESSAGING',
    description: 'Notification when a shared support/shared inbox thread is assigned to you.',
    subject: 'Conversation assigned to you: "{{conversation.subject}}"',
    previewText: '{{actor.name}} assigned a customer conversation to you.',
    htmlBody: `
      ${EmailHeading('Conversation Assigned')}
      ${EmailText('<strong>{{actor.name}}</strong> assigned the conversation <strong>"{{conversation.subject}}"</strong> to you.')}
      ${EmailButton('Open Conversation', '{{conversation.url || "http://localhost:4200"}}')}
    `,
    textBody: `Conversation assigned to you: "{{conversation.subject}}".\n\nOpen: {{conversation.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Assigner', sampleValue: 'Support Lead' },
        { name: 'conversation.subject', type: 'string', description: 'Subject', sampleValue: 'Billing inquiry #4892' },
      ],
      samplePayload: { actor: { name: 'Support Lead' }, conversation: { subject: 'Billing inquiry #4892' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_CONVERSATION_REASSIGNED',
    name: 'Conversation Reassigned',
    category: 'MESSAGING',
    description: 'Notice when an inbox thread is moved from you to someone else.',
    subject: 'Conversation reassigned: "{{conversation.subject}}"',
    previewText: '{{conversation.subject}} was reassigned.',
    htmlBody: `
      ${EmailHeading('Conversation Reassigned')}
      ${EmailText('The conversation <strong>"{{conversation.subject}}"</strong> was reassigned to <strong>{{newAssignee.name}}</strong>.')}
    `,
    textBody: `Conversation reassigned: "{{conversation.subject}}" to {{newAssignee.name}}.`,
    variablesSchema: {
      variables: [
        { name: 'conversation.subject', type: 'string', description: 'Subject', sampleValue: 'Issue #102' },
        { name: 'newAssignee.name', type: 'string', description: 'New owner', sampleValue: 'Sarah' },
      ],
      samplePayload: { conversation: { subject: 'Issue #102' }, newAssignee: { name: 'Sarah' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_IMPORTANT_CONVERSATION',
    name: 'Important Conversation Notification',
    category: 'MESSAGING',
    description: 'High-priority notification for marked VIP or critical conversations.',
    subject: 'Priority thread: {{conversation.subject}}',
    previewText: 'Important thread in {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Important Conversation')}
      ${EmailAlert('This conversation was marked high-priority.', 'warning')}
      ${EmailText('<strong>{{sender.name}}</strong>: "{{message.snippet}}"')}
      ${EmailButton('View Thread', '{{conversation.url || "http://localhost:4200"}}')}
    `,
    textBody: `Priority thread: {{conversation.subject}}\n\n"{{message.snippet}}"\n\nView: {{conversation.url}}`,
    variablesSchema: {
      variables: [
        { name: 'conversation.subject', type: 'string', description: 'Subject', sampleValue: 'Server Outage Report' },
        { name: 'message.snippet', type: 'string', description: 'Snippet', sampleValue: 'Database high connection load' },
      ],
      samplePayload: { conversation: { subject: 'Server Outage Report' }, message: { snippet: 'High connection load' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MSG_ESCALATION',
    name: 'Escalation Notification',
    category: 'MESSAGING',
    description: 'Urgent escalation alert triggered by an incident or SLA threshold.',
    subject: 'URGENT ESCALATION: {{escalation.title}}',
    previewText: 'SLA Escalation required.',
    htmlBody: `
      ${EmailHeading('Urgent Escalation')}
      ${EmailAlert('{{escalation.title}} has exceeded SLA threshold and requires immediate attention.', 'danger')}
      ${EmailButton('Handle Escalation', '{{escalation.url || "http://localhost:4200"}}', { color: '#dc2626' })}
    `,
    textBody: `URGENT ESCALATION: {{escalation.title}}!\n\nOpen: {{escalation.url}}`,
    variablesSchema: {
      variables: [
        { name: 'escalation.title', type: 'string', description: 'Title', sampleValue: 'Tier 1 Ticket #9482 Overdue' },
        { name: 'escalation.url', type: 'url', description: 'URL' },
      ],
      samplePayload: { escalation: { title: 'Tier 1 Ticket #9482 Overdue', url: 'https://app.onetab.ai/inbox/9482' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
