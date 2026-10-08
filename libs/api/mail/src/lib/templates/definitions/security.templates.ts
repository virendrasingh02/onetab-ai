import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailSecurityNotice,
  EmailText,
} from '../../components/index.js';

export const SECURITY_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'SECURITY_NEW_LOGIN',
    name: 'New Sign-in Alert',
    category: 'SECURITY',
    description: 'Notice when user signs in from a new IP or location.',
    subject: 'Security Alert: New sign-in to your account',
    previewText: 'A sign-in occurred from {{login.location || "a new location"}}.',
    htmlBody: `
      ${EmailHeading('Security Alert: New sign-in')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We detected a new sign-in to your account:')}
      ${EmailCard([
        { label: 'Time', value: '{{formatDate login.timestamp}}' },
        { label: 'Location', value: '{{login.location || "Unknown"}}' },
        { label: 'IP Address', value: '{{login.ip || "Unknown"}}' },
      ])}
      ${EmailSecurityNotice('If you did not sign in recently, review active sessions immediately.')}
      ${EmailButton('Review Sessions', '{{securityUrl || "http://localhost:4200/settings/security"}}')}
    `,
    textBody: `Security Alert: New sign-in\nTime: {{formatDate login.timestamp}}\nLocation: {{login.location}}\nIP: {{login.ip}}\n\nReview: {{securityUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'login.location', type: 'string', description: 'Location', sampleValue: 'San Francisco, CA' },
        { name: 'login.ip', type: 'string', description: 'IP', sampleValue: '192.0.2.1' },
      ],
      samplePayload: { login: { location: 'San Francisco, CA', ip: '192.0.2.1' }, securityUrl: 'https://app.onetab.ai/settings/security' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_NEW_DEVICE',
    name: 'New Device Detected',
    category: 'SECURITY',
    description: 'Alert when signed in from an unrecognized hardware device.',
    subject: 'Security Alert: New device detected',
    previewText: '{{device.name || "A new device"}} accessed your account.',
    htmlBody: `
      ${EmailHeading('New Device Detected')}
      ${EmailText('A sign-in was confirmed from a device we have not seen before:')}
      ${EmailCard([
        { label: 'Device', value: '{{device.name || "Unknown device"}}' },
        { label: 'Browser', value: '{{device.browser || "Web browser"}}' },
        { label: 'IP', value: '{{device.ip || "Unknown"}}' },
      ])}
      ${EmailSecurityNotice('If this was not you, lock your account immediately.')}
      ${EmailButton('Lock Account & Reset Password', '{{securityUrl || "http://localhost:4200/settings/security"}}', { color: '#dc2626' })}
    `,
    textBody: `New Device Detected: {{device.name}}\n\nReview: {{securityUrl}}`,
    variablesSchema: {
      variables: [{ name: 'device.name', type: 'string', description: 'Device', sampleValue: 'iPhone 16 Pro' }],
      samplePayload: { device: { name: 'iPhone 16 Pro', browser: 'Safari 19' }, securityUrl: 'https://app.onetab.ai/settings/security' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_SUSPICIOUS_ACTIVITY',
    name: 'Suspicious Activity Detected',
    category: 'SECURITY',
    description: 'Emergency security notice triggered by anomalies.',
    subject: 'URGENT: Suspicious activity on your {{appName || "OneTab AI"}} account',
    previewText: 'Potential security incident detected on your account.',
    htmlBody: `
      ${EmailHeading('Suspicious Activity Alert 🚨')}
      ${EmailAlert('Our security system detected anomalous behavior on your account.', 'danger')}
      ${EmailText('Details: {{activity.description || "Unusual number of failed authentication challenges or rate limit spikes."}}')}
      ${EmailButton('Secure My Account', '{{securityUrl || "http://localhost:4200/settings/security"}}', { color: '#dc2626' })}
    `,
    textBody: `URGENT: Suspicious activity detected on your account.\n\nDetails: {{activity.description}}\n\nSecure: {{securityUrl}}`,
    variablesSchema: {
      variables: [{ name: 'activity.description', type: 'string', description: 'Anomaly details', sampleValue: 'Multiple failed 2FA attempts' }],
      samplePayload: { activity: { description: 'Multiple failed 2FA attempts' }, securityUrl: 'https://app.onetab.ai/settings/security' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_PASSWORD_CHANGED',
    name: 'Security Alert: Password Changed',
    category: 'SECURITY',
    description: 'Alert sent whenever password is updated.',
    subject: 'Security Alert: Your password was changed',
    previewText: 'Your account password was updated.',
    htmlBody: `
      ${EmailHeading('Your password was changed')}
      ${EmailText('The password for your account was changed on {{formatDate timestamp}}.')}
      ${EmailSecurityNotice('If you did not authorize this, please reset your password and contact security immediately.')}
      ${EmailButton('Reset Password', '{{resetUrl || "http://localhost:4200/forgot-password"}}', { color: '#dc2626' })}
    `,
    textBody: `Your password was changed on {{formatDate timestamp}}.\n\nIf not you, reset now: {{resetUrl}}`,
    variablesSchema: {
      variables: [{ name: 'timestamp', type: 'date', description: 'Timestamp', sampleValue: '2026-10-07T12:00:00Z' }],
      samplePayload: { timestamp: '2026-10-07T12:00:00Z', resetUrl: 'https://app.onetab.ai/forgot-password' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_EMAIL_CHANGED',
    name: 'Security Alert: Email Changed',
    category: 'SECURITY',
    description: 'Alert sent when account email is updated.',
    subject: 'Security Alert: Primary email address changed',
    previewText: 'Your account email was updated.',
    htmlBody: `
      ${EmailHeading('Email Address Changed')}
      ${EmailAlert('Your primary account email address was changed to {{newEmail}}.', 'warning')}
      ${EmailSecurityNotice('If you did NOT perform this action, someone has compromised your account.')}
    `,
    textBody: `Your primary account email was changed to {{newEmail}}. If you did not do this, contact support immediately.`,
    variablesSchema: {
      variables: [{ name: 'newEmail', type: 'string', description: 'New email', sampleValue: 'new@example.com' }],
      samplePayload: { newEmail: 'new@example.com' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_2FA_CHANGED',
    name: 'Two-Factor Setting Changed',
    category: 'SECURITY',
    description: 'Notice when 2FA method (authenticator, SMS, backup codes) is updated.',
    subject: 'Security Alert: Two-factor authentication updated',
    previewText: 'Changes were made to your 2FA settings.',
    htmlBody: `
      ${EmailHeading('2FA Settings Updated')}
      ${EmailText('Changes were made to your two-factor authentication configuration.')}
      ${EmailSecurityNotice('If you did not make this change, inspect your security settings immediately.')}
      ${EmailButton('Review Security Settings', '{{securityUrl || "http://localhost:4200/settings/security"}}')}
    `,
    textBody: `Changes were made to your 2FA settings. Review: {{securityUrl}}`,
    variablesSchema: {
      variables: [{ name: 'securityUrl', type: 'url', description: 'URL' }],
      samplePayload: { securityUrl: 'https://app.onetab.ai/settings/security' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_API_KEY_CREATED',
    name: 'API Key Created',
    category: 'SECURITY',
    description: 'Notice when a new personal or workspace API key is generated.',
    subject: 'New API Key created: {{apiKey.name}}',
    previewText: 'An API key was generated for your workspace.',
    htmlBody: `
      ${EmailHeading('New API Key Generated')}
      ${EmailText('A new API token <strong>{{apiKey.name}}</strong> was created by {{actor.name}} with permissions: {{apiKey.scopes || "Standard API access"}}.')}
      ${EmailSecurityNotice('Never share API tokens. If you did not generate this key, revoke it immediately.')}
      ${EmailButton('Manage API Keys', '{{apiKey.url || "http://localhost:4200/settings/keys"}}')}
    `,
    textBody: `New API Key generated: {{apiKey.name}} by {{actor.name}}.\n\nManage: {{apiKey.url}}`,
    variablesSchema: {
      variables: [
        { name: 'apiKey.name', type: 'string', description: 'Key name', sampleValue: 'CI/CD Token' },
        { name: 'actor.name', type: 'string', description: 'Creator', sampleValue: 'Alex' },
      ],
      samplePayload: { apiKey: { name: 'CI/CD Token', scopes: 'read,write' }, actor: { name: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_API_KEY_REVOKED',
    name: 'API Key Revoked',
    category: 'SECURITY',
    description: 'Notice when an API key is deleted or revoked.',
    subject: 'API Key revoked: {{apiKey.name}}',
    previewText: '{{apiKey.name}} is no longer active.',
    htmlBody: `
      ${EmailHeading('API Key Revoked')}
      ${EmailText('The API token <strong>{{apiKey.name}}</strong> was revoked by {{actor.name}}. Applications using this token will no longer authenticate.')}
    `,
    textBody: `API Key revoked: {{apiKey.name}} by {{actor.name}}.`,
    variablesSchema: {
      variables: [{ name: 'apiKey.name', type: 'string', description: 'Key name', sampleValue: 'CI/CD Token' }],
      samplePayload: { apiKey: { name: 'CI/CD Token' }, actor: { name: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_INTEGRATION_CONNECTED',
    name: 'Integration Connected',
    category: 'SECURITY',
    description: 'Notification when a third-party OAuth app is linked to workspace.',
    subject: 'New integration connected: {{integration.name}}',
    previewText: '{{integration.name}} was linked to {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Integration Connected')}
      ${EmailText('<strong>{{actor.name}}</strong> connected the <strong>{{integration.name}}</strong> integration to <strong>{{workspace.name}}</strong>.')}
      ${EmailButton('View Integrations', '{{workspace.url || "http://localhost:4200"}}/settings/integrations')}
    `,
    textBody: `{{actor.name}} connected {{integration.name}} to {{workspace.name}}.\n\nView: {{workspace.url}}/settings/integrations`,
    variablesSchema: {
      variables: [
        { name: 'integration.name', type: 'string', description: 'App name', sampleValue: 'GitHub' },
        { name: 'actor.name', type: 'string', description: 'Actor', sampleValue: 'Alex' },
      ],
      samplePayload: { integration: { name: 'GitHub' }, actor: { name: 'Alex' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_INTEGRATION_DISCONNECTED',
    name: 'Integration Disconnected',
    category: 'SECURITY',
    description: 'Notice when an integration is unlinked.',
    subject: 'Integration disconnected: {{integration.name}}',
    previewText: '{{integration.name}} was disconnected.',
    htmlBody: `
      ${EmailHeading('Integration Disconnected')}
      ${EmailText('The integration <strong>{{integration.name}}</strong> was unlinked from <strong>{{workspace.name}}</strong>.')}
    `,
    textBody: `Integration disconnected: {{integration.name}}.`,
    variablesSchema: {
      variables: [{ name: 'integration.name', type: 'string', description: 'App name', sampleValue: 'GitHub' }],
      samplePayload: { integration: { name: 'GitHub' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_SESSION_REVOKED',
    name: 'Session Revoked',
    category: 'SECURITY',
    description: 'Notice when an active device session is terminated remotely.',
    subject: 'Device session revoked',
    previewText: 'A session for {{device.name || "your device"}} was terminated.',
    htmlBody: `
      ${EmailHeading('Session Terminated')}
      ${EmailText('A session on <strong>{{device.name || "a device"}}</strong> was logged out or revoked remotely.')}
      ${EmailSecurityNotice('If you did not revoke this session, change your password immediately.')}
    `,
    textBody: `A session on {{device.name || "a device"}} was revoked remotely.`,
    variablesSchema: {
      variables: [{ name: 'device.name', type: 'string', description: 'Device', sampleValue: 'Chrome on Windows' }],
      samplePayload: { device: { name: 'Chrome on Windows' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'SECURITY_SETTING_CHANGED',
    name: 'Security Setting Changed',
    category: 'SECURITY',
    description: 'Notice when a workspace security policy (e.g. SSO enforcement, session timeout) is altered.',
    subject: 'Workspace security setting updated: {{setting.name}}',
    previewText: 'A security policy was modified in {{workspace.name}}.',
    htmlBody: `
      ${EmailHeading('Security Policy Updated')}
      ${EmailAlert('The security setting "{{setting.name}}" was updated in {{workspace.name}} by {{actor.name}}.', 'warning')}
      ${EmailButton('Review Policies', '{{workspace.url || "http://localhost:4200"}}/settings/permissions')}
    `,
    textBody: `Security setting "{{setting.name}}" updated in {{workspace.name}} by {{actor.name}}.\n\nReview: {{workspace.url}}/settings/permissions`,
    variablesSchema: {
      variables: [
        { name: 'setting.name', type: 'string', description: 'Setting', sampleValue: 'Enforce SAML SSO' },
        { name: 'actor.name', type: 'string', description: 'Actor', sampleValue: 'Alex' },
      ],
      samplePayload: { setting: { name: 'Enforce SAML SSO' }, actor: { name: 'Alex' }, workspace: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
