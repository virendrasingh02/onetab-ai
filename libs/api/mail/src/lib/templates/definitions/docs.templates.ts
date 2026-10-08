import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const DOCS_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'DOC_SHARED',
    name: 'Document Shared',
    category: 'DOCS',
    description: 'Notification when someone shares a document with you.',
    subject: '{{actor.name}} shared a document with you: "{{doc.title}}"',
    previewText: '{{actor.name}} gave you access to {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Document Shared')}
      ${EmailText('<strong>{{actor.name}}</strong> shared the document <strong>"{{doc.title}}"</strong> with you.')}
      ${EmailButton('Open Document', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} shared "{{doc.title}}" with you.\n\nOpen: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Author name', sampleValue: 'Sarah' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Q4 Product Roadmap' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, doc: { title: 'Q4 Product Roadmap' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_ACCESS_REQUESTED',
    name: 'Document Access Requested',
    category: 'DOCS',
    description: 'Sent to document owner when a teammate requests view or edit access.',
    subject: '{{requester.name}} requested access to "{{doc.title}}"',
    previewText: '{{requester.name}} wants access to {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Access Requested')}
      ${EmailText('<strong>{{requester.name}}</strong> ({{requester.email}}) requested {{accessLevel || "view"}} access to your document <strong>"{{doc.title}}"</strong>.')}
      ${EmailButton('Grant Access', '{{grantUrl || "http://localhost:4200"}}')}
    `,
    textBody: `{{requester.name}} requested access to "{{doc.title}}".\n\nGrant: {{grantUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'requester.name', type: 'string', description: 'Requester name', sampleValue: 'John' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Internal Strategy' },
      ],
      samplePayload: { requester: { name: 'John' }, doc: { title: 'Internal Strategy' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_ACCESS_APPROVED',
    name: 'Document Access Approved',
    category: 'DOCS',
    description: 'Sent when an access request is approved.',
    subject: 'Access approved for "{{doc.title}}"',
    previewText: 'You now have access to {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Access Approved')}
      ${EmailAlert('Your request to access "{{doc.title}}" was approved.', 'success')}
      ${EmailButton('Open Document', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `Your access to "{{doc.title}}" was approved!\n\nOpen: {{doc.url}}`,
    variablesSchema: {
      variables: [{ name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Internal Strategy' }],
      samplePayload: { doc: { title: 'Internal Strategy' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_ACCESS_DENIED',
    name: 'Document Access Denied',
    category: 'DOCS',
    description: 'Sent when an access request is declined.',
    subject: 'Access request for "{{doc.title}}" was declined',
    previewText: 'Your access request was declined.',
    htmlBody: `
      ${EmailHeading('Access Declined')}
      ${EmailText('Your request for access to <strong>"{{doc.title}}"</strong> was declined by the owner.')}
    `,
    textBody: `Your request for access to "{{doc.title}}" was declined.`,
    variablesSchema: {
      variables: [{ name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Confidential M&A' }],
      samplePayload: { doc: { title: 'Confidential M&A' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_MENTIONED',
    name: 'User Mentioned in Document',
    category: 'DOCS',
    description: 'Notification when tagged inside document text.',
    subject: '{{actor.name}} mentioned you in "{{doc.title}}"',
    previewText: '{{actor.name}} mentioned you in {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Mentioned in Document')}
      ${EmailText('<strong>{{actor.name}}</strong> tagged you in <strong>"{{doc.title}}"</strong>.')}
      ${EmailButton('View Mention', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} mentioned you in "{{doc.title}}".\n\nView: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Author', sampleValue: 'Sarah' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Architecture Guide' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, doc: { title: 'Architecture Guide' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_COMMENT',
    name: 'Document Comment',
    category: 'DOCS',
    description: 'Sent when someone comments on your document.',
    subject: 'New comment on "{{doc.title}}" by {{actor.name}}',
    previewText: '"{{comment.snippet}}"',
    htmlBody: `
      ${EmailHeading('New Document Comment')}
      ${EmailText('<strong>{{actor.name}}</strong> commented on <strong>"{{doc.title}}"</strong>:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{comment.snippet}}
      </div>
      ${EmailButton('Reply to Comment', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} commented on "{{doc.title}}":\n\n"{{comment.snippet}}"\n\nReply: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Author', sampleValue: 'Sarah' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Design System Guidelines' },
        { name: 'comment.snippet', type: 'string', description: 'Snippet', sampleValue: 'Looks great! One small typo on page 2.' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, doc: { title: 'Design System Guidelines' }, comment: { snippet: 'Looks great!' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_COMMENT_REPLY',
    name: 'Comment Reply',
    category: 'DOCS',
    description: 'Sent when someone replies to your comment thread in a document.',
    subject: '{{actor.name}} replied to your comment on "{{doc.title}}"',
    previewText: 'New reply from {{actor.name}}.',
    htmlBody: `
      ${EmailHeading('Reply to your comment')}
      ${EmailText('<strong>{{actor.name}}</strong> replied to your comment thread:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{reply.snippet}}
      </div>
      ${EmailButton('View Reply', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} replied on "{{doc.title}}":\n\n"{{reply.snippet}}"\n\nView: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Replier', sampleValue: 'Alex' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Design System Guidelines' },
        { name: 'reply.snippet', type: 'string', description: 'Reply text', sampleValue: 'Agreed, updating now.' },
      ],
      samplePayload: { actor: { name: 'Alex' }, doc: { title: 'Design System Guidelines' }, reply: { snippet: 'Agreed, updating now.' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_REVIEW_REQUEST',
    name: 'Document Review Request',
    category: 'DOCS',
    description: 'Sent when a document author asks for peer review.',
    subject: 'Review requested: "{{doc.title}}"',
    previewText: '{{actor.name}} requested your review on {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Review Requested')}
      ${EmailText('<strong>{{actor.name}}</strong> requested your review and approval on <strong>"{{doc.title}}"</strong>.')}
      ${EmailButton('Review Document', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} requested your review on "{{doc.title}}".\n\nReview: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Author', sampleValue: 'Elena' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Security Policy 2026' },
      ],
      samplePayload: { actor: { name: 'Elena' }, doc: { title: 'Security Policy 2026' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_APPROVED',
    name: 'Document Approved',
    category: 'DOCS',
    description: 'Sent when reviewer approves document changes.',
    subject: 'Document approved: "{{doc.title}}"',
    previewText: '{{reviewer.name}} approved {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Document Approved')}
      ${EmailAlert('{{reviewer.name}} approved "{{doc.title}}".', 'success')}
      ${EmailButton('Open Document', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{reviewer.name}} approved "{{doc.title}}".\n\nOpen: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'reviewer.name', type: 'string', description: 'Reviewer', sampleValue: 'Alex' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Security Policy 2026' },
      ],
      samplePayload: { reviewer: { name: 'Alex' }, doc: { title: 'Security Policy 2026' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_REJECTED',
    name: 'Document Changes Requested / Rejected',
    category: 'DOCS',
    description: 'Sent when reviewer requests changes or rejects approval.',
    subject: 'Changes requested on "{{doc.title}}"',
    previewText: '{{reviewer.name}} requested changes on {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Changes Requested')}
      ${EmailAlert('{{reviewer.name}} requested changes on "{{doc.title}}".', 'warning')}
      ${EmailText('Feedback: {{feedback || "Please check comment suggestions."}}')}
      ${EmailButton('View Feedback', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `Changes requested on "{{doc.title}}" by {{reviewer.name}}.\n\nFeedback: {{feedback}}\n\nView: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'reviewer.name', type: 'string', description: 'Reviewer', sampleValue: 'Alex' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Security Policy 2026' },
        { name: 'feedback', type: 'string', description: 'Feedback note', sampleValue: 'Need compliance section added.' },
      ],
      samplePayload: { reviewer: { name: 'Alex' }, doc: { title: 'Security Policy 2026' }, feedback: 'Need compliance section added.' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_PUBLISHED',
    name: 'Document Published',
    category: 'DOCS',
    description: 'Notification when document is officially published to workspace knowledge base.',
    subject: 'Document published: "{{doc.title}}"',
    previewText: '{{doc.title}} is now live.',
    htmlBody: `
      ${EmailHeading('Document Published')}
      ${EmailText('The document <strong>"{{doc.title}}"</strong> has been published to the workspace knowledge base.')}
      ${EmailButton('Read Document', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `Document published: "{{doc.title}}".\n\nRead: {{doc.url}}`,
    variablesSchema: {
      variables: [{ name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Employee Handbook' }],
      samplePayload: { doc: { title: 'Employee Handbook' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'DOC_UPDATED',
    name: 'Document Major Update',
    category: 'DOCS',
    description: 'Notice sent to subscribers when a subscribed document receives a major revision.',
    subject: 'Update to "{{doc.title}}"',
    previewText: '{{actor.name}} updated {{doc.title}}.',
    htmlBody: `
      ${EmailHeading('Document Updated')}
      ${EmailText('<strong>{{actor.name}}</strong> updated the document <strong>"{{doc.title}}"</strong>.')}
      ${EmailButton('View Changes', '{{doc.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} updated "{{doc.title}}".\n\nView changes: {{doc.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Editor', sampleValue: 'Sarah' },
        { name: 'doc.title', type: 'string', description: 'Document title', sampleValue: 'Employee Handbook' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, doc: { title: 'Employee Handbook' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
