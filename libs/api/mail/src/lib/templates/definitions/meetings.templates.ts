import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const MEETINGS_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'MEETING_INVITATION',
    name: 'Meeting Invitation',
    category: 'MEETINGS',
    description: 'Invitation to scheduled video huddle or calendar meeting.',
    subject: 'Meeting Invitation: {{meeting.title}} ({{meeting.date}} at {{meeting.time}})',
    previewText: '{{meeting.host}} invited you to {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('{{meeting.title}}')}
      ${EmailText('<strong>{{meeting.host}}</strong> has invited you to a meeting.')}
      ${EmailCard([
        { label: 'Date', value: '{{meeting.date}}' },
        { label: 'Time', value: '{{meeting.time}} ({{meeting.timezone || "UTC"}})' },
        { label: 'Duration', value: '{{meeting.duration || "30 mins"}}' },
        { label: 'Host', value: '{{meeting.host}}' },
      ])}
      ${EmailButton('Join Meeting', '{{meeting.url || "http://localhost:4200"}}')}
    `,
    textBody: `Meeting Invitation: {{meeting.title}}\n\nDate: {{meeting.date}}\nTime: {{meeting.time}} ({{meeting.timezone}})\nHost: {{meeting.host}}\n\nJoin: {{meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Sprint Planning' },
        { name: 'meeting.date', type: 'string', description: 'Date', sampleValue: 'Thursday, Oct 15, 2026' },
        { name: 'meeting.time', type: 'string', description: 'Time', sampleValue: '10:00 AM' },
        { name: 'meeting.timezone', type: 'string', description: 'Timezone', sampleValue: 'PST' },
        { name: 'meeting.duration', type: 'string', description: 'Duration', sampleValue: '45 mins' },
        { name: 'meeting.host', type: 'string', description: 'Host name', sampleValue: 'Alex Rivera' },
        { name: 'meeting.url', type: 'url', description: 'Join URL', sampleValue: 'https://app.onetab.ai/meet/123' },
      ],
      samplePayload: {
        meeting: {
          title: 'Sprint Planning',
          date: 'Thursday, Oct 15, 2026',
          time: '10:00 AM',
          timezone: 'PST',
          duration: '45 mins',
          host: 'Alex Rivera',
          url: 'https://app.onetab.ai/meet/123',
        },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_INVITATION_ACCEPTED',
    name: 'Meeting Invitation Accepted',
    category: 'MEETINGS',
    description: 'RSVP notification when an attendee accepts.',
    subject: '{{attendee.name}} accepted: {{meeting.title}}',
    previewText: '{{attendee.name}} accepted your meeting invite.',
    htmlBody: `
      ${EmailHeading('RSVP Accepted')}
      ${EmailText('<strong>{{attendee.name}}</strong> accepted your invitation to <strong>{{meeting.title}}</strong>.')}
    `,
    textBody: `{{attendee.name}} accepted your invitation to {{meeting.title}}.`,
    variablesSchema: {
      variables: [
        { name: 'attendee.name', type: 'string', description: 'Attendee name', sampleValue: 'Dana' },
        { name: 'meeting.title', type: 'string', description: 'Meeting title', sampleValue: 'Sprint Planning' },
      ],
      samplePayload: { attendee: { name: 'Dana' }, meeting: { title: 'Sprint Planning' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_INVITATION_DECLINED',
    name: 'Meeting Invitation Declined',
    category: 'MEETINGS',
    description: 'RSVP notification when an attendee declines.',
    subject: '{{attendee.name}} declined: {{meeting.title}}',
    previewText: '{{attendee.name}} declined your meeting invite.',
    htmlBody: `
      ${EmailHeading('RSVP Declined')}
      ${EmailText('<strong>{{attendee.name}}</strong> declined the invitation to <strong>{{meeting.title}}</strong>.')}
    `,
    textBody: `{{attendee.name}} declined your invitation to {{meeting.title}}.`,
    variablesSchema: {
      variables: [
        { name: 'attendee.name', type: 'string', description: 'Attendee name', sampleValue: 'Dana' },
        { name: 'meeting.title', type: 'string', description: 'Meeting title', sampleValue: 'Sprint Planning' },
      ],
      samplePayload: { attendee: { name: 'Dana' }, meeting: { title: 'Sprint Planning' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_REMINDER',
    name: 'Meeting Reminder',
    category: 'MEETINGS',
    description: 'Advance reminder (e.g. 1 hour or 24 hours before meeting).',
    subject: 'Reminder: "{{meeting.title}}" is coming up on {{meeting.date}}',
    previewText: 'Upcoming meeting with {{meeting.host}}.',
    htmlBody: `
      ${EmailHeading('Meeting Reminder')}
      ${EmailText('Here is your reminder for <strong>{{meeting.title}}</strong>:')}
      ${EmailCard([
        { label: 'When', value: '{{meeting.date}} at {{meeting.time}} ({{meeting.timezone}})' },
        { label: 'Host', value: '{{meeting.host}}' },
      ])}
      ${EmailButton('Join Meeting', '{{meeting.url}}')}
    `,
    textBody: `Reminder: {{meeting.title}} on {{meeting.date}} at {{meeting.time}}.\n\nJoin: {{meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Meeting title', sampleValue: 'Design Review' },
        { name: 'meeting.date', type: 'string', description: 'Date', sampleValue: 'Oct 15' },
        { name: 'meeting.time', type: 'string', description: 'Time', sampleValue: '2:00 PM' },
      ],
      samplePayload: { meeting: { title: 'Design Review', date: 'Oct 15', time: '2:00 PM', url: 'https://app.onetab.ai/meet/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_STARTING_SOON',
    name: 'Meeting Starting Soon (10 min)',
    category: 'MEETINGS',
    description: 'Sent 10 minutes before the call starts.',
    subject: 'Starting soon: {{meeting.title}}',
    previewText: '{{meeting.title}} starts in 10 minutes.',
    htmlBody: `
      ${EmailHeading('{{meeting.title}} is starting now')}
      ${EmailAlert('The meeting starts in 10 minutes.', 'info')}
      ${EmailButton('Join Room Now', '{{meeting.url}}')}
    `,
    textBody: `Starting soon: {{meeting.title}}!\n\nJoin room: {{meeting.url}}`,
    variablesSchema: {
      variables: [{ name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Daily Standup' }],
      samplePayload: { meeting: { title: 'Daily Standup', url: 'https://app.onetab.ai/meet/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_RESCHEDULED',
    name: 'Meeting Rescheduled',
    category: 'MEETINGS',
    description: 'Sent when the host updates the date or time.',
    subject: 'Rescheduled: {{meeting.title}} (New time: {{meeting.date}} at {{meeting.time}})',
    previewText: 'New time for {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('Meeting Rescheduled')}
      ${EmailAlert('The date or time for {{meeting.title}} has been changed.', 'warning')}
      ${EmailCard([
        { label: 'New Date', value: '{{meeting.date}}' },
        { label: 'New Time', value: '{{meeting.time}} ({{meeting.timezone}})' },
        { label: 'Host', value: '{{meeting.host}}' },
      ])}
      ${EmailButton('View Updated Invite', '{{meeting.url}}')}
    `,
    textBody: `Rescheduled: {{meeting.title}}\n\nNew time: {{meeting.date}} at {{meeting.time}}\n\nView: {{meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Architecture Review' },
        { name: 'meeting.date', type: 'string', description: 'New date', sampleValue: 'Friday, Oct 16' },
        { name: 'meeting.time', type: 'string', description: 'New time', sampleValue: '11:00 AM' },
      ],
      samplePayload: { meeting: { title: 'Architecture Review', date: 'Friday, Oct 16', time: '11:00 AM', url: 'https://app.onetab.ai/meet/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_CANCELLED',
    name: 'Meeting Cancelled',
    category: 'MEETINGS',
    description: 'Sent when a scheduled meeting is cancelled.',
    subject: 'Cancelled: {{meeting.title}}',
    previewText: '{{meeting.title}} has been cancelled.',
    htmlBody: `
      ${EmailHeading('Meeting Cancelled')}
      ${EmailAlert('The scheduled meeting {{meeting.title}} has been cancelled by {{meeting.host}}.', 'danger')}
      ${EmailText('Reason: {{cancelReason || "Cancelled by host"}}')}
    `,
    textBody: `Cancelled: {{meeting.title}} by {{meeting.host}}.\nReason: {{cancelReason || "Cancelled by host"}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Sync Call' },
        { name: 'meeting.host', type: 'string', description: 'Host', sampleValue: 'Alex' },
      ],
      samplePayload: { meeting: { title: 'Sync Call', host: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_RECORDING_AVAILABLE',
    name: 'Meeting Recording Available',
    category: 'MEETINGS',
    description: 'Notification when the cloud recording finishes processing.',
    subject: 'Recording available: {{meeting.title}}',
    previewText: 'Watch the recording for {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('Recording Ready 🎥')}
      ${EmailText('The recording for <strong>{{meeting.title}}</strong> is now available for playback.')}
      ${EmailButton('Watch Recording', '{{recording.url || meeting.url}}')}
    `,
    textBody: `Recording available for {{meeting.title}}!\n\nWatch: {{recording.url || meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'All Hands' },
        { name: 'recording.url', type: 'url', description: 'Recording URL' },
      ],
      samplePayload: { meeting: { title: 'All Hands', url: 'https://app.onetab.ai/recordings/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_TRANSCRIPT_AVAILABLE',
    name: 'Meeting Transcript Available',
    category: 'MEETINGS',
    description: 'Notification when speech-to-text transcript is ready.',
    subject: 'Transcript ready: {{meeting.title}}',
    previewText: 'Read the full transcript for {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('Transcript Available 📝')}
      ${EmailText('The full AI transcript for <strong>{{meeting.title}}</strong> has been processed.')}
      ${EmailButton('Read Transcript', '{{transcript.url || meeting.url}}')}
    `,
    textBody: `Transcript ready for {{meeting.title}}!\n\nRead: {{transcript.url || meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'All Hands' },
        { name: 'transcript.url', type: 'url', description: 'Transcript URL' },
      ],
      samplePayload: { meeting: { title: 'All Hands', url: 'https://app.onetab.ai/transcripts/123' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_SUMMARY_AVAILABLE',
    name: 'Meeting Summary & Key Takeaways',
    category: 'MEETINGS',
    description: 'AI-generated executive summary of the meeting.',
    subject: 'AI Summary: {{meeting.title}}',
    previewText: 'Key decisions and summary for {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('Meeting Summary & Takeaways 💡')}
      ${EmailText('Here is the AI-generated summary for <strong>{{meeting.title}}</strong>:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; line-height: 1.6;">
        {{meeting.summary}}
      </div>
      ${EmailButton('View Meeting Notes', '{{meeting.url}}')}
    `,
    textBody: `Meeting Summary: {{meeting.title}}\n\n{{meeting.summary}}\n\nView: {{meeting.url}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Quarterly Planning' },
        { name: 'meeting.summary', type: 'string', description: 'Summary', sampleValue: 'Agreed on roadmap dates and team allocation.' },
      ],
      samplePayload: { meeting: { title: 'Quarterly Planning', summary: 'Agreed on roadmap dates and team allocation.', url: 'https://app.onetab.ai/meetings/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'MEETING_ACTION_ITEMS_ASSIGNED',
    name: 'Meeting Action Items Assigned',
    category: 'MEETINGS',
    description: 'Dispatches action items generated during the call.',
    subject: 'Action items assigned from {{meeting.title}}',
    previewText: 'You have action items from {{meeting.title}}.',
    htmlBody: `
      ${EmailHeading('Action Items Assigned')}
      ${EmailText('Following <strong>{{meeting.title}}</strong>, the following action items were assigned to you:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border-left: 3px solid #3b82f6; font-size: 13px;">
        {{actionItems}}
      </div>
      ${EmailButton('View Tasks in Board', '{{meeting.tasksUrl || "http://localhost:4200/tasks"}}')}
    `,
    textBody: `Action items from {{meeting.title}}:\n\n{{actionItems}}\n\nView: {{meeting.tasksUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'meeting.title', type: 'string', description: 'Title', sampleValue: 'Quarterly Planning' },
        { name: 'actionItems', type: 'string', description: 'List of items', sampleValue: '1. Update budget spreadsheet\n2. Schedule follow up' },
      ],
      samplePayload: { meeting: { title: 'Quarterly Planning', tasksUrl: 'https://app.onetab.ai/tasks' }, actionItems: '1. Update budget spreadsheet' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
