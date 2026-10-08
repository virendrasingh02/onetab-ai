import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const TEAM_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'TEAM_MEMBER_JOINED',
    name: 'New Member Joined Team',
    category: 'TEAM',
    description: 'Notifies team leads or channel members when someone joins.',
    subject: '{{member.name}} joined {{team.name || workspace.name}}',
    previewText: 'Say hello to {{member.name}}!',
    htmlBody: `
      ${EmailHeading('{{member.name}} has joined')}
      ${EmailText('A new teammate, <strong>{{member.name}}</strong>, has joined <strong>{{team.name || workspace.name}}</strong>.')}
      ${EmailButton('Say Hello', '{{team.url || workspace.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{member.name}} joined {{team.name || workspace.name}}!\n\nSay hello: {{team.url || workspace.url}}`,
    variablesSchema: {
      variables: [
        { name: 'member.name', type: 'string', description: 'New member name', sampleValue: 'Dana Scully' },
        { name: 'team.name', type: 'string', description: 'Team name', sampleValue: 'Engineering' },
      ],
      samplePayload: { member: { name: 'Dana Scully' }, team: { name: 'Engineering' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_MEMBER_REMOVED',
    name: 'Member Removed from Team',
    category: 'TEAM',
    description: 'Sent when a user is unassigned from a specific sub-team or user group.',
    subject: 'You have been removed from {{team.name}}',
    previewText: 'Your membership in {{team.name}} has been updated.',
    htmlBody: `
      ${EmailHeading('Team update')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('You have been removed from the <strong>{{team.name}}</strong> team.')}
    `,
    textBody: `You have been removed from {{team.name}}.`,
    variablesSchema: {
      variables: [{ name: 'team.name', type: 'string', description: 'Team name', sampleValue: 'Design' }],
      samplePayload: { team: { name: 'Design' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_ROLE_CHANGED',
    name: 'Team Role Changed',
    category: 'TEAM',
    description: 'Sent when a role inside a specific functional team is modified.',
    subject: 'Your team role in {{team.name}} was changed to {{role.name}}',
    previewText: 'Your role in {{team.name}} was updated.',
    htmlBody: `
      ${EmailHeading('Role changed')}
      ${EmailText('Your role in <strong>{{team.name}}</strong> is now <strong>{{role.name}}</strong>.')}
      ${EmailButton('View Team', '{{team.url || "http://localhost:4200"}}')}
    `,
    textBody: `Your role in {{team.name}} is now {{role.name}}.\n\nView team: {{team.url}}`,
    variablesSchema: {
      variables: [
        { name: 'team.name', type: 'string', description: 'Team name', sampleValue: 'Frontend' },
        { name: 'role.name', type: 'string', description: 'Role name', sampleValue: 'Team Lead' },
      ],
      samplePayload: { team: { name: 'Frontend' }, role: { name: 'Team Lead' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_ADMIN_ROLE_GRANTED',
    name: 'Admin Role Granted',
    category: 'TEAM',
    description: 'Security alert sent when administrative privileges are granted.',
    subject: 'You have been granted Administrator permissions in {{workspace.name}}',
    previewText: 'You now have admin privileges in {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Admin Privileges Granted')}
      ${EmailAlert('You have been promoted to Workspace Administrator in {{workspace.name}}.', 'info')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('With this role, you can manage team members, workspace integrations, channels, and security settings.')}
      ${EmailButton('Open Admin Console', '{{workspace.url || "http://localhost:4200"}}/settings')}
    `,
    textBody: `Admin Privileges Granted\n\nYou are now an Administrator in {{workspace.name}}.\n\nAdmin console: {{workspace.url}}/settings`,
    variablesSchema: {
      variables: [{ name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' }],
      samplePayload: { workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_ADMIN_ROLE_REMOVED',
    name: 'Admin Role Removed',
    category: 'TEAM',
    description: 'Notice sent when administrative privileges are revoked.',
    subject: 'Admin permissions updated in {{workspace.name}}',
    previewText: 'Your administrator privileges have been updated.',
    htmlBody: `
      ${EmailHeading('Admin Privileges Updated')}
      ${EmailText('Your administrator privileges in <strong>{{workspace.name}}</strong> have been revoked. You remain a standard member.')}
    `,
    textBody: `Your administrator privileges in {{workspace.name}} have been revoked.`,
    variablesSchema: {
      variables: [{ name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' }],
      samplePayload: { workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_USER_MENTIONED',
    name: 'User Mentioned in Conversation',
    category: 'TEAM',
    description: 'Notification when someone tags a user with @mention.',
    subject: '{{actor.name}} mentioned you in #{{channel.name || "conversation"}}',
    previewText: '"{{mention.snippet || "mentioned you"}}"',
    htmlBody: `
      ${EmailHeading('You were mentioned')}
      ${EmailText('<strong>{{actor.name}}</strong> mentioned you in <strong>#{{channel.name || "conversation"}}</strong>:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px; color: #1e293b;">
        {{mention.snippet || "view mention"}}
      </div>
      ${EmailButton('Reply in Thread', '{{message.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} mentioned you in #{{channel.name || "conversation"}}:\n\n"{{mention.snippet}}"\n\nReply: {{message.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Person mentioning', sampleValue: 'Sarah' },
        { name: 'channel.name', type: 'string', description: 'Channel name', sampleValue: 'general' },
        { name: 'mention.snippet', type: 'string', description: 'Snippet', sampleValue: 'Hey @Alex can you check this pull request?' },
        { name: 'message.url', type: 'url', description: 'Deep link to message' },
      ],
      samplePayload: {
        actor: { name: 'Sarah' },
        channel: { name: 'general' },
        mention: { snippet: 'Hey @Alex can you check this pull request?' },
        message: { url: 'https://app.onetab.ai/channels/general?msg=123' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_USER_ASSIGNED_TASK',
    name: 'User Assigned to Task',
    category: 'TEAM',
    description: 'Dispatched when a colleague assigns a task.',
    subject: '{{actor.name}} assigned you to "{{task.name}}"',
    previewText: 'You were assigned to {{task.name}}.',
    htmlBody: `
      ${EmailHeading('New task assigned')}
      ${EmailText('<strong>{{actor.name}}</strong> assigned you to the task:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 600; color: #0f172a;">
        {{task.name}}
      </div>
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} assigned you to "{{task.name}}".\n\nView task: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Assigner name', sampleValue: 'Sarah' },
        { name: 'task.name', type: 'string', description: 'Task title', sampleValue: 'Deploy v2 API' },
        { name: 'task.url', type: 'url', description: 'Task URL' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, task: { name: 'Deploy v2 API', url: 'https://app.onetab.ai/tasks/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_USER_ADDED_PROJECT',
    name: 'User Added to Project',
    category: 'TEAM',
    description: 'Notification when added to a project board.',
    subject: 'You were added to project "{{project.name}}"',
    previewText: 'Collaborate on {{project.name}}.',
    htmlBody: `
      ${EmailHeading('Added to Project')}
      ${EmailText('You were added as a contributor to the project <strong>{{project.name}}</strong>.')}
      ${EmailButton('Open Project', '{{project.url || "http://localhost:4200"}}')}
    `,
    textBody: `You were added to project "{{project.name}}".\n\nOpen: {{project.url}}`,
    variablesSchema: {
      variables: [
        { name: 'project.name', type: 'string', description: 'Project title', sampleValue: 'Q4 Launch' },
        { name: 'project.url', type: 'url', description: 'Project URL' },
      ],
      samplePayload: { project: { name: 'Q4 Launch', url: 'https://app.onetab.ai/projects/q4' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_USER_ADDED_CHANNEL',
    name: 'User Added to Channel',
    category: 'TEAM',
    description: 'Notice when added to a private channel.',
    subject: '{{actor.name}} added you to #{{channel.name}}',
    previewText: 'You now have access to #{{channel.name}}.',
    htmlBody: `
      ${EmailHeading('Added to #{{channel.name}}')}
      ${EmailText('<strong>{{actor.name}}</strong> added you to the private channel <strong>#{{channel.name}}</strong>.')}
      ${EmailButton('Open Channel', '{{channel.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} added you to #{{channel.name}}.\n\nOpen: {{channel.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Person who added you', sampleValue: 'Sarah' },
        { name: 'channel.name', type: 'string', description: 'Channel name', sampleValue: 'marketing-leads' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, channel: { name: 'marketing-leads' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_USER_INVITED_CONVERSATION',
    name: 'User Invited to Conversation',
    category: 'TEAM',
    description: 'Sent when invited to a group direct message thread.',
    subject: '{{actor.name}} started a conversation with you',
    previewText: 'New group conversation in {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('New Conversation')}
      ${EmailText('<strong>{{actor.name}}</strong> invited you to a direct group conversation.')}
      ${EmailButton('Open Conversation', '{{conversation.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} invited you to a group conversation.\n\nOpen: {{conversation.url}}`,
    variablesSchema: {
      variables: [{ name: 'actor.name', type: 'string', description: 'Initiator', sampleValue: 'Sarah' }],
      samplePayload: { actor: { name: 'Sarah' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TEAM_RESOURCE_SHARED',
    name: 'Shared Resource Notification',
    category: 'TEAM',
    description: 'Sent when a teammate shares a file, view, or resource.',
    subject: '{{actor.name}} shared a resource with you: "{{resource.name}}"',
    previewText: '{{actor.name}} shared {{resource.name}}.',
    htmlBody: `
      ${EmailHeading('Resource shared')}
      ${EmailText('<strong>{{actor.name}}</strong> shared <strong>{{resource.name}}</strong> ({{resource.type || "file"}}) with you.')}
      ${EmailButton('View Resource', '{{resource.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} shared "{{resource.name}}" with you.\n\nView: {{resource.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Sharer', sampleValue: 'Sarah' },
        { name: 'resource.name', type: 'string', description: 'Resource name', sampleValue: 'Architecture Diagram.png' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, resource: { name: 'Architecture Diagram.png' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
