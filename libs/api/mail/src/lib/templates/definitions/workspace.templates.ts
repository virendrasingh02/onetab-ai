import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailSecurityNotice,
  EmailText,
} from '../../components/index.js';

export const WORKSPACE_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'WORKSPACE_INVITATION',
    name: 'Workspace Invitation',
    category: 'WORKSPACE',
    description: 'Sent when an existing workspace member invites a teammate.',
    subject: '{{inviter.name || "A teammate"}} invited you to {{workspace.name}} on {{appName || "OneTab AI"}}',
    previewText: 'Join {{workspace.name}} as {{role.name || "a member"}}.',
    htmlBody: `
      ${EmailHeading('Join {{workspace.name}}')}
      ${EmailText('Hi {{invitee.name || "there"}},')}
      ${EmailText('<strong>{{inviter.name || "A teammate"}}</strong> has invited you to join the <strong>{{workspace.name}}</strong> workspace on {{appName || "OneTab AI"}}{{#if role.name}} with the role of <strong>{{role.name}}</strong>{{/if}}.')}
      ${EmailCard([
        { label: 'Workspace', value: '{{workspace.name}}' },
        { label: 'Invited by', value: '{{inviter.name || "Teammate"}}' },
        { label: 'Role', value: '{{role.name || "Member"}}' },
      ])}
      ${EmailButton('Accept Invitation', '{{invitation.url}}')}
      ${EmailText('This invitation will expire on {{formatDate invitation.expiresAt}}.', 'muted')}
      ${EmailSecurityNotice('If you were not expecting this invitation, you can safely disregard this email or decline.')}
    `,
    textBody: `Join {{workspace.name}} on {{appName || "OneTab AI"}}\n\nHi {{invitee.name || "there"}},\n\n{{inviter.name || "A teammate"}} invited you to join {{workspace.name}}{{#if role.name}} as {{role.name}}{{/if}}.\n\nAccept here:\n{{invitation.url}}\n\nExpires: {{formatDate invitation.expiresAt}}`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'workspace.logo', type: 'url', description: 'Workspace logo URL' },
        { name: 'inviter.name', type: 'string', description: 'Inviter name', sampleValue: 'Sarah Connor' },
        { name: 'invitee.name', type: 'string', description: 'Invitee name', sampleValue: 'John Doe' },
        { name: 'invitation.url', type: 'url', description: 'Accept URL', sampleValue: 'https://app.onetab.ai/invite/abc' },
        { name: 'invitation.expiresAt', type: 'date', description: 'Expiration date', sampleValue: '2026-10-14T00:00:00Z' },
        { name: 'role.name', type: 'string', description: 'Role assigned', sampleValue: 'Member' },
      ],
      samplePayload: {
        workspace: { name: 'Acme Corp' },
        inviter: { name: 'Sarah Connor' },
        invitee: { name: 'John Doe' },
        invitation: { url: 'https://app.onetab.ai/invite/abc', expiresAt: '2026-10-14T00:00:00Z' },
        role: { name: 'Member' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_INVITATION_REMINDER',
    name: 'Workspace Invitation Reminder',
    category: 'WORKSPACE',
    description: 'Gentle reminder sent before a pending invitation expires.',
    subject: 'Reminder: You have a pending invitation to join {{workspace.name}}',
    previewText: 'Your invitation to {{workspace.name}} will expire soon.',
    htmlBody: `
      ${EmailHeading('Don\'t forget: Invitation to {{workspace.name}}')}
      ${EmailText('Hi {{invitee.name || "there"}},')}
      ${EmailText('Just a quick reminder that your invitation to join <strong>{{workspace.name}}</strong> from <strong>{{inviter.name || "your team"}}</strong> is waiting for you.')}
      ${EmailButton('Accept & Join Workspace', '{{invitation.url}}')}
      ${EmailText('This link expires on {{formatDate invitation.expiresAt}}.', 'muted')}
    `,
    textBody: `Reminder: Join {{workspace.name}}\n\nHi {{invitee.name || "there"}},\n\nYour invitation from {{inviter.name || "your team"}} expires soon.\n\nAccept:\n{{invitation.url}}`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'inviter.name', type: 'string', description: 'Inviter name', sampleValue: 'Sarah Connor' },
        { name: 'invitation.url', type: 'url', description: 'Accept URL', sampleValue: 'https://app.onetab.ai/invite/abc' },
      ],
      samplePayload: {
        workspace: { name: 'Acme Corp' },
        inviter: { name: 'Sarah Connor' },
        invitation: { url: 'https://app.onetab.ai/invite/abc' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_INVITATION_ACCEPTED',
    name: 'Workspace Invitation Accepted',
    category: 'WORKSPACE',
    description: 'Notifies workspace admins/inviter when an invitee accepts.',
    subject: '{{invitee.name}} accepted your invitation to {{workspace.name}}',
    previewText: '{{invitee.name}} has joined {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('New teammate joined')}
      ${EmailText('Great news! <strong>{{invitee.name}}</strong> has accepted your invitation and joined <strong>{{workspace.name}}</strong>.')}
      ${EmailButton('View Workspace Members', '{{workspace.url || "http://localhost:4200"}}/settings/members')}
    `,
    textBody: `{{invitee.name}} accepted your invitation to {{workspace.name}}!\n\nView members: {{workspace.url}}/settings/members`,
    variablesSchema: {
      variables: [
        { name: 'invitee.name', type: 'string', description: 'New member name', sampleValue: 'John Doe' },
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { invitee: { name: 'John Doe' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_INVITATION_DECLINED',
    name: 'Workspace Invitation Declined',
    category: 'WORKSPACE',
    description: 'Notifies the inviter if an invitee declines an invitation.',
    subject: 'Invitation to {{workspace.name}} was declined',
    previewText: '{{invitee.name}} declined the invitation to join {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Invitation Declined')}
      ${EmailText('<strong>{{invitee.name}}</strong> has declined the invitation to join the <strong>{{workspace.name}}</strong> workspace.')}
      ${EmailText('If this was in error, you can send a fresh invitation from your Workspace Members settings.', 'muted')}
    `,
    textBody: `{{invitee.name}} declined the invitation to join {{workspace.name}}.`,
    variablesSchema: {
      variables: [
        { name: 'invitee.name', type: 'string', description: 'Invitee name', sampleValue: 'John Doe' },
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { invitee: { name: 'John Doe' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_INVITATION_EXPIRED',
    name: 'Workspace Invitation Expired',
    category: 'WORKSPACE',
    description: 'Alerts inviter that an invitation expired without being accepted.',
    subject: 'Invitation to {{invitee.email}} for {{workspace.name}} expired',
    previewText: 'The invitation has expired. You can resend it anytime.',
    htmlBody: `
      ${EmailHeading('Invitation Expired')}
      ${EmailText('The invitation sent to <strong>{{invitee.email}}</strong> to join <strong>{{workspace.name}}</strong> expired.')}
      ${EmailButton('Resend Invitation', '{{resendUrl || "http://localhost:4200"}}')}
    `,
    textBody: `Invitation to {{invitee.email}} for {{workspace.name}} has expired.`,
    variablesSchema: {
      variables: [
        { name: 'invitee.email', type: 'string', description: 'Invitee email', sampleValue: 'john@example.com' },
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { invitee: { email: 'john@example.com' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_MEMBER_ADDED',
    name: 'Workspace Member Added',
    category: 'WORKSPACE',
    description: 'Welcome notice sent when a user is directly added to a workspace.',
    subject: 'You have been added to {{workspace.name}}',
    previewText: 'You now have access to {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Welcome to {{workspace.name}}')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('You have been added as a member of <strong>{{workspace.name}}</strong> with the role of <strong>{{role.name || "Member"}}</strong>.')}
      ${EmailButton('Open Workspace', '{{workspace.url || "http://localhost:4200"}}')}
    `,
    textBody: `You have been added to {{workspace.name}} as {{role.name || "Member"}}.\n\nOpen: {{workspace.url || "http://localhost:4200"}}`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'role.name', type: 'string', description: 'Role name', sampleValue: 'Member' },
      ],
      samplePayload: { workspace: { name: 'Acme Corp' }, role: { name: 'Member' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_MEMBER_REMOVED',
    name: 'Workspace Member Removed',
    category: 'WORKSPACE',
    description: 'Notice sent to a user when removed from a workspace.',
    subject: 'Your access to {{workspace.name}} has ended',
    previewText: 'You are no longer a member of {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Access ended')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your membership in the <strong>{{workspace.name}}</strong> workspace has been removed by an administrator.')}
      ${EmailText('You will no longer have access to channels, documents, or data within this workspace.')}
      ${EmailSecurityNotice('If you believe this was an error, please reach out to your workspace administrator.')}
    `,
    textBody: `Your access to {{workspace.name}} has ended.\n\nIf you believe this was in error, please contact your workspace administrator.`,
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
    templateKey: 'WORKSPACE_ROLE_CHANGED',
    name: 'Workspace Role Changed',
    category: 'WORKSPACE',
    description: 'Notification sent when a member’s role is elevated or modified.',
    subject: 'Your role in {{workspace.name}} was updated to {{role.name}}',
    previewText: 'Your workspace permissions have changed.',
    htmlBody: `
      ${EmailHeading('Role Updated')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('An administrator has updated your role in <strong>{{workspace.name}}</strong> to <strong>{{role.name}}</strong>.')}
      ${EmailButton('View Workspace', '{{workspace.url || "http://localhost:4200"}}')}
    `,
    textBody: `Your role in {{workspace.name}} was updated to {{role.name}}.\n\nView workspace: {{workspace.url || "http://localhost:4200"}}`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'role.name', type: 'string', description: 'New role name', sampleValue: 'Admin' },
      ],
      samplePayload: { workspace: { name: 'Acme Corp' }, role: { name: 'Admin' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
    name: 'Workspace Ownership Transferred',
    category: 'WORKSPACE',
    description: 'Sent when ownership of a workspace is assigned to another user.',
    subject: 'Workspace ownership transferred: {{workspace.name}}',
    previewText: 'Ownership of {{workspace.name}} was transferred.',
    htmlBody: `
      ${EmailHeading('Ownership Transferred')}
      ${EmailAlert('Ownership of the {{workspace.name}} workspace has been transferred to {{newOwner.name}}.', 'info')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Primary ownership and administrative billing controls for <strong>{{workspace.name}}</strong> have been reassigned.')}
      ${EmailButton('Manage Workspace', '{{workspace.url || "http://localhost:4200"}}/settings')}
    `,
    textBody: `Workspace ownership transferred: {{workspace.name}}\n\nOwnership transferred to {{newOwner.name}}.`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'newOwner.name', type: 'string', description: 'New owner name', sampleValue: 'Alex Rivera' },
      ],
      samplePayload: { workspace: { name: 'Acme Corp' }, newOwner: { name: 'Alex Rivera' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_ACTIVATED',
    name: 'Workspace Activated',
    category: 'WORKSPACE',
    description: 'Sent when a workspace is created or newly activated.',
    subject: 'Your workspace {{workspace.name}} is active',
    previewText: '{{workspace.name}} is live and ready for collaboration.',
    htmlBody: `
      ${EmailHeading('{{workspace.name}} is ready')}
      ${EmailText('Your workspace is active. Invite your team, create your first channel, and connect integrations.')}
      ${EmailButton('Launch Workspace', '{{workspace.url || "http://localhost:4200"}}')}
    `,
    textBody: `Your workspace {{workspace.name}} is active!\n\nLaunch: {{workspace.url || "http://localhost:4200"}}`,
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
    templateKey: 'WORKSPACE_DEACTIVATED',
    name: 'Workspace Deactivated',
    category: 'WORKSPACE',
    description: 'Notice sent to owners/admins when a workspace is suspended or deactivated.',
    subject: 'Important: {{workspace.name}} has been deactivated',
    previewText: 'Your workspace has been paused or deactivated.',
    htmlBody: `
      ${EmailHeading('Workspace Deactivated')}
      ${EmailAlert('The workspace {{workspace.name}} is currently deactivated. Team members cannot access workspace data.', 'warning')}
      ${EmailText('Reason: {{reason || "Administrator request or subscription status"}}')}
      ${EmailButton('Reactivate Workspace', '{{reactivateUrl || "http://localhost:4200/settings"}}')}
    `,
    textBody: `Important: {{workspace.name}} has been deactivated.\n\nReason: {{reason || "Administrator request"}}\nReactivate: {{reactivateUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' },
        { name: 'reason', type: 'string', description: 'Deactivation reason', sampleValue: 'Subscription ended' },
      ],
      samplePayload: { workspace: { name: 'Acme Corp' }, reason: 'Subscription ended' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'WORKSPACE_RESTORED',
    name: 'Workspace Restored',
    category: 'WORKSPACE',
    description: 'Sent when a previously archived or deactivated workspace is restored.',
    subject: '{{workspace.name}} has been restored',
    previewText: 'Your workspace is active again.',
    htmlBody: `
      ${EmailHeading('Workspace Restored')}
      ${EmailAlert('The workspace {{workspace.name}} has been restored. All channels, documents, and historical messages are accessible.', 'success')}
      ${EmailButton('Go to Workspace', '{{workspace.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{workspace.name}} has been restored and is active again.\n\nGo to workspace: {{workspace.url}}`,
    variablesSchema: {
      variables: [{ name: 'workspace.name', type: 'string', description: 'Workspace name', sampleValue: 'Acme Corp' }],
      samplePayload: { workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
