import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const PROJECT_TASK_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'PROJECT_INVITATION',
    name: 'Project Invitation',
    category: 'PROJECTS',
    description: 'Invitation to collaborate on a project.',
    subject: 'You were invited to project {{project.name}}',
    previewText: 'Join the project team for {{project.name}}.',
    htmlBody: `
      ${EmailHeading('Project Invitation')}
      ${EmailText('You have been invited to collaborate on <strong>{{project.name}}</strong>.')}
      ${EmailButton('Open Project', '{{project.url || "http://localhost:4200"}}')}
    `,
    textBody: `You were invited to project {{project.name}}.\n\nOpen: {{project.url}}`,
    variablesSchema: {
      variables: [
        { name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'Mobile App Redesign' },
        { name: 'project.url', type: 'url', description: 'Project URL' },
      ],
      samplePayload: { project: { name: 'Mobile App Redesign', url: 'https://app.onetab.ai/projects/mobile' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'PROJECT_CREATED',
    name: 'Project Created',
    category: 'PROJECTS',
    description: 'Alert when a new workspace initiative/project is started.',
    subject: 'New project created: {{project.name}}',
    previewText: '{{actor.name}} created project {{project.name}}.',
    htmlBody: `
      ${EmailHeading('New Project')}
      ${EmailText('<strong>{{actor.name}}</strong> created the project <strong>{{project.name}}</strong>.')}
      ${EmailButton('View Project', '{{project.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} created project {{project.name}}.\n\nView: {{project.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Creator', sampleValue: 'Alex' },
        { name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'Security Hardening' },
      ],
      samplePayload: { actor: { name: 'Alex' }, project: { name: 'Security Hardening' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_ASSIGNED',
    name: 'Task Assigned',
    category: 'TASKS',
    description: 'Notification when assigned to a task.',
    subject: 'Task assigned: {{task.name}}',
    previewText: 'You were assigned to {{task.name}} in {{project.name}}.',
    htmlBody: `
      ${EmailHeading('Task Assigned')}
      ${EmailText('<strong>{{actor.name || "A teammate"}}</strong> assigned you to:')}
      ${EmailCard([
        { label: 'Task', value: '{{task.name}}' },
        { label: 'Project', value: '{{project.name || "General"}}' },
        { label: 'Priority', value: '{{task.priority || "Medium"}}' },
        { label: 'Due Date', value: '{{formatDate task.dueDate}}' },
      ])}
      ${EmailButton('View Task Details', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `Task assigned: {{task.name}}\n\nProject: {{project.name}}\nDue: {{formatDate task.dueDate}}\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Audit API endpoints' },
        { name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'SOC2 Compliance' },
        { name: 'task.dueDate', type: 'date', description: 'Due date', sampleValue: '2026-10-15T00:00:00Z' },
        { name: 'task.url', type: 'url', description: 'Task URL' },
      ],
      samplePayload: {
        task: { name: 'Audit API endpoints', priority: 'High', dueDate: '2026-10-15T00:00:00Z', url: 'https://app.onetab.ai/tasks/1' },
        project: { name: 'SOC2 Compliance' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_REASSIGNED',
    name: 'Task Reassigned',
    category: 'TASKS',
    description: 'Notice when a task is reassigned to another teammate.',
    subject: 'Task reassigned: {{task.name}}',
    previewText: '{{task.name}} was reassigned to {{task.assignee}}.',
    htmlBody: `
      ${EmailHeading('Task Reassigned')}
      ${EmailText('The task <strong>{{task.name}}</strong> was reassigned to <strong>{{task.assignee}}</strong> by {{actor.name}}.')}
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `Task reassigned: {{task.name}} to {{task.assignee}}.\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Design new badge' },
        { name: 'task.assignee', type: 'string', description: 'New assignee', sampleValue: 'Elena' },
      ],
      samplePayload: { task: { name: 'Design new badge', assignee: 'Elena' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_DUE_SOON',
    name: 'Task Due Soon',
    category: 'TASKS',
    description: 'Reminder sent 24-48 hours before task due date.',
    subject: 'Reminder: "{{task.name}}" is due {{formatDate task.dueDate}}',
    previewText: '{{task.name}} is due soon.',
    htmlBody: `
      ${EmailHeading('Task Due Soon')}
      ${EmailAlert('Your assigned task is due on {{formatDate task.dueDate}}.', 'warning')}
      ${EmailCard([
        { label: 'Task', value: '{{task.name}}' },
        { label: 'Status', value: '{{task.status || "In Progress"}}' },
        { label: 'Due Date', value: '{{formatDate task.dueDate}}' },
      ])}
      ${EmailButton('Complete Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `Task Due Soon: "{{task.name}}"\nDue: {{formatDate task.dueDate}}\n\nOpen: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Submit tax documentation' },
        { name: 'task.dueDate', type: 'date', description: 'Due date', sampleValue: '2026-10-09T00:00:00Z' },
      ],
      samplePayload: { task: { name: 'Submit tax documentation', dueDate: '2026-10-09T00:00:00Z' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_OVERDUE',
    name: 'Task Overdue',
    category: 'TASKS',
    description: 'High-priority alert when a task misses its due date.',
    subject: 'Action Required: "{{task.name}}" is overdue',
    previewText: '{{task.name}} was due on {{formatDate task.dueDate}}.',
    htmlBody: `
      ${EmailHeading('Task Overdue')}
      ${EmailAlert('The following task was due on {{formatDate task.dueDate}} and is marked overdue.', 'danger')}
      ${EmailCard([
        { label: 'Task', value: '{{task.name}}' },
        { label: 'Priority', value: '{{task.priority || "High"}}' },
        { label: 'Original Due Date', value: '{{formatDate task.dueDate}}' },
      ])}
      ${EmailButton('Update Task Status', '{{task.url || "http://localhost:4200"}}', { color: '#dc2626' })}
    `,
    textBody: `Action Required: "{{task.name}}" is overdue!\nOriginal due date: {{formatDate task.dueDate}}\n\nUpdate: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Renew SSL Certificate' },
        { name: 'task.dueDate', type: 'date', description: 'Due date', sampleValue: '2026-10-05T00:00:00Z' },
      ],
      samplePayload: { task: { name: 'Renew SSL Certificate', dueDate: '2026-10-05T00:00:00Z' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_COMPLETED',
    name: 'Task Completed',
    category: 'TASKS',
    description: 'Notification when a task you created or follow is marked done.',
    subject: 'Task completed: {{task.name}}',
    previewText: '{{actor.name}} completed {{task.name}}.',
    htmlBody: `
      ${EmailHeading('Task Completed')}
      ${EmailAlert('{{actor.name}} marked {{task.name}} as completed.', 'success')}
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} completed "{{task.name}}".\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Completer', sampleValue: 'Elena' },
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Fix dark mode contrast' },
      ],
      samplePayload: { actor: { name: 'Elena' }, task: { name: 'Fix dark mode contrast' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_STATUS_CHANGED',
    name: 'Task Status Changed',
    category: 'TASKS',
    description: 'Notice when task state changes (e.g., In Review, Blocked).',
    subject: 'Task status changed to {{task.status}}: {{task.name}}',
    previewText: '{{task.name}} is now {{task.status}}.',
    htmlBody: `
      ${EmailHeading('Status Updated')}
      ${EmailText('The task <strong>{{task.name}}</strong> moved to <strong>{{task.status}}</strong> by {{actor.name}}.')}
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `Task status changed: "{{task.name}}" is now {{task.status}}.\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Database migration' },
        { name: 'task.status', type: 'string', description: 'New status', sampleValue: 'In Review' },
      ],
      samplePayload: { task: { name: 'Database migration', status: 'In Review' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_PRIORITY_CHANGED',
    name: 'Task Priority Changed',
    category: 'TASKS',
    description: 'Notice when priority level changes (e.g., Urgent).',
    subject: 'Priority updated to {{task.priority}}: {{task.name}}',
    previewText: '{{task.name}} priority is now {{task.priority}}.',
    htmlBody: `
      ${EmailHeading('Priority Updated')}
      ${EmailText('The priority for <strong>{{task.name}}</strong> was updated to <strong>{{task.priority}}</strong> by {{actor.name}}.')}
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `Task priority changed: "{{task.name}}" is now {{task.priority}}.\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Production hotfix' },
        { name: 'task.priority', type: 'string', description: 'Priority', sampleValue: 'Urgent' },
      ],
      samplePayload: { task: { name: 'Production hotfix', priority: 'Urgent' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_COMMENTED',
    name: 'Task Commented',
    category: 'TASKS',
    description: 'Notification when a comment is added to a task you follow.',
    subject: 'New comment on "{{task.name}}" by {{actor.name}}',
    previewText: '"{{comment.snippet}}"',
    htmlBody: `
      ${EmailHeading('New Comment')}
      ${EmailText('<strong>{{actor.name}}</strong> commented on <strong>{{task.name}}</strong>:')}
      <div style="margin: 16px 0; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{comment.snippet}}
      </div>
      ${EmailButton('Reply to Comment', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} commented on "{{task.name}}":\n\n"{{comment.snippet}}"\n\nReply: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Commenter', sampleValue: 'Sarah' },
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Fix mobile crash' },
        { name: 'comment.snippet', type: 'string', description: 'Comment text', sampleValue: 'Found the root cause in the memory leak.' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, task: { name: 'Fix mobile crash' }, comment: { snippet: 'Found the root cause.' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'TASK_USER_MENTIONED',
    name: 'User Mentioned in Task',
    category: 'TASKS',
    description: 'Notification when tagged in a task description or comment.',
    subject: '{{actor.name}} mentioned you in task "{{task.name}}"',
    previewText: '{{actor.name}} mentioned you in {{task.name}}.',
    htmlBody: `
      ${EmailHeading('Mentioned in Task')}
      ${EmailText('<strong>{{actor.name}}</strong> mentioned you in <strong>{{task.name}}</strong>.')}
      ${EmailButton('View Task', '{{task.url || "http://localhost:4200"}}')}
    `,
    textBody: `{{actor.name}} mentioned you in task "{{task.name}}".\n\nView: {{task.url}}`,
    variablesSchema: {
      variables: [
        { name: 'actor.name', type: 'string', description: 'Author', sampleValue: 'Sarah' },
        { name: 'task.name', type: 'string', description: 'Task name', sampleValue: 'Update terms of service' },
      ],
      samplePayload: { actor: { name: 'Sarah' }, task: { name: 'Update terms of service' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'PROJECT_MILESTONE_REACHED',
    name: 'Project Milestone Reached',
    category: 'PROJECTS',
    description: 'Celebratory notification when a major milestone is hit.',
    subject: 'Milestone reached in {{project.name}}: {{milestone.name}}',
    previewText: 'Congratulations! {{milestone.name}} was reached.',
    htmlBody: `
      ${EmailHeading('Milestone Reached! 🎉')}
      ${EmailAlert('The team reached milestone {{milestone.name}} in {{project.name}}.', 'success')}
      ${EmailButton('View Milestone', '{{project.url || "http://localhost:4200"}}')}
    `,
    textBody: `Milestone reached in {{project.name}}: {{milestone.name}}!\n\nView: {{project.url}}`,
    variablesSchema: {
      variables: [
        { name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'Sprint 24' },
        { name: 'milestone.name', type: 'string', description: 'Milestone name', sampleValue: 'Beta Release Complete' },
      ],
      samplePayload: { project: { name: 'Sprint 24' }, milestone: { name: 'Beta Release Complete' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'PROJECT_COMPLETED',
    name: 'Project Completed',
    category: 'PROJECTS',
    description: 'Notification when all tasks in a project are delivered.',
    subject: 'Project completed: {{project.name}}',
    previewText: '{{project.name}} has been marked completed.',
    htmlBody: `
      ${EmailHeading('Project Completed 🚀')}
      ${EmailAlert('{{project.name}} has been completed. All project tasks and deliverables are done.', 'success')}
      ${EmailButton('View Project Summary', '{{project.url || "http://localhost:4200"}}')}
    `,
    textBody: `Project completed: {{project.name}}!\n\nView: {{project.url}}`,
    variablesSchema: {
      variables: [{ name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'Q3 Brand Refresh' }],
      samplePayload: { project: { name: 'Q3 Brand Refresh' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'PROJECT_ARCHIVED',
    name: 'Project Archived',
    category: 'PROJECTS',
    description: 'Notice when a project is archived by its manager.',
    subject: 'Project archived: {{project.name}}',
    previewText: '{{project.name}} was archived.',
    htmlBody: `
      ${EmailHeading('Project Archived')}
      ${EmailText('The project <strong>{{project.name}}</strong> has been archived.')}
    `,
    textBody: `Project archived: {{project.name}}.`,
    variablesSchema: {
      variables: [{ name: 'project.name', type: 'string', description: 'Project name', sampleValue: 'Old Migration' }],
      samplePayload: { project: { name: 'Old Migration' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
