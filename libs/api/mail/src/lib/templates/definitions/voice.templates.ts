import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const VOICE_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'VOICE_SESSION_SCHEDULED',
    name: 'Voice Session Scheduled',
    category: 'VOICE',
    description: 'Notice when a voice consultation or phone call is booked.',
    subject: 'Voice call scheduled with {{host.name}} ({{call.date}} at {{call.time}})',
    previewText: 'Voice consultation confirmed for {{call.date}}.',
    htmlBody: `
      ${EmailHeading('Voice Call Scheduled 📞')}
      ${EmailText('A voice session has been scheduled with <strong>{{host.name}}</strong>.')}
      ${EmailCard([
        { label: 'Date', value: '{{call.date}}' },
        { label: 'Time', value: '{{call.time}} ({{call.timezone || "UTC"}})' },
        { label: 'Dial-in / Room', value: '{{call.dialIn || "OneTab Voice Room"}}' },
      ])}
      ${EmailButton('Join Voice Room', '{{call.url || "http://localhost:4200"}}')}
    `,
    textBody: `Voice call scheduled with {{host.name}}\nDate: {{call.date}} at {{call.time}}\n\nJoin: {{call.url}}`,
    variablesSchema: {
      variables: [
        { name: 'host.name', type: 'string', description: 'Host', sampleValue: 'Support Agent' },
        { name: 'call.date', type: 'string', description: 'Date', sampleValue: 'Oct 15' },
        { name: 'call.time', type: 'string', description: 'Time', sampleValue: '1:00 PM' },
      ],
      samplePayload: { host: { name: 'Support Agent' }, call: { date: 'Oct 15', time: '1:00 PM', url: 'https://app.onetab.ai/voice/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_SESSION_REMINDER',
    name: 'Voice Session Reminder',
    category: 'VOICE',
    description: 'Advance reminder before voice call starts.',
    subject: 'Voice call reminder: Call starting in 15 minutes',
    previewText: 'Upcoming voice call with {{host.name}}.',
    htmlBody: `
      ${EmailHeading('Voice Call Starting Soon')}
      ${EmailAlert('Your call with {{host.name}} begins in 15 minutes.', 'info')}
      ${EmailButton('Join Call Room', '{{call.url || "http://localhost:4200"}}')}
    `,
    textBody: `Voice call starting in 15 minutes with {{host.name}}.\n\nJoin: {{call.url}}`,
    variablesSchema: {
      variables: [{ name: 'host.name', type: 'string', description: 'Host', sampleValue: 'Support Agent' }],
      samplePayload: { host: { name: 'Support Agent' }, call: { url: 'https://app.onetab.ai/voice/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_CALL_COMPLETED',
    name: 'Call Completed',
    category: 'VOICE',
    description: 'Post-call receipt and duration summary.',
    subject: 'Call summary: {{call.duration || "Call"}} with {{caller.name}}',
    previewText: 'Call completed. View logs.',
    htmlBody: `
      ${EmailHeading('Call Completed')}
      ${EmailText('Your voice call with <strong>{{caller.name}}</strong> has ended.')}
      ${EmailCard([
        { label: 'Duration', value: '{{call.duration || "12 minutes"}}' },
        { label: 'Ended At', value: '{{call.endedAt || "Just now"}}' },
      ])}
      ${EmailButton('View Call Details', '{{call.url || "http://localhost:4200"}}')}
    `,
    textBody: `Call completed with {{caller.name}}.\nDuration: {{call.duration}}\n\nDetails: {{call.url}}`,
    variablesSchema: {
      variables: [
        { name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Alex' },
        { name: 'call.duration', type: 'string', description: 'Duration', sampleValue: '14 mins 20 secs' },
      ],
      samplePayload: { caller: { name: 'Alex' }, call: { duration: '14 mins', url: 'https://app.onetab.ai/voice/logs/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_MISSED_CALL',
    name: 'Missed Call Notification',
    category: 'VOICE',
    description: 'Alert sent when an inbound voice call goes unanswered.',
    subject: 'Missed call from {{caller.name || "Unknown caller"}}',
    previewText: 'You missed a call from {{caller.name}}.',
    htmlBody: `
      ${EmailHeading('Missed Voice Call 📵')}
      ${EmailAlert('You missed a call from {{caller.name || caller.phone || "a caller"}} on {{call.time || "today"}}.', 'warning')}
      ${EmailButton('Call Back / Reply', '{{call.callbackUrl || "http://localhost:4200"}}')}
    `,
    textBody: `Missed call from {{caller.name || "a caller"}}.\n\nCall back: {{call.callbackUrl}}`,
    variablesSchema: {
      variables: [{ name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Sarah' }],
      samplePayload: { caller: { name: 'Sarah' }, call: { callbackUrl: 'https://app.onetab.ai/voice/call/sarah' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_RECORDING_READY',
    name: 'Voice Recording Ready',
    category: 'VOICE',
    description: 'Notification when voice audio recording file is encoded.',
    subject: 'Voice recording ready: Call with {{caller.name}}',
    previewText: 'Audio recording is ready to listen.',
    htmlBody: `
      ${EmailHeading('Recording Ready 🎙️')}
      ${EmailText('The audio recording for your call with <strong>{{caller.name}}</strong> is ready.')}
      ${EmailButton('Listen to Audio', '{{recording.url || call.url}}')}
    `,
    textBody: `Voice recording ready for call with {{caller.name}}.\n\nListen: {{recording.url}}`,
    variablesSchema: {
      variables: [
        { name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Client A' },
        { name: 'recording.url', type: 'url', description: 'Audio URL' },
      ],
      samplePayload: { caller: { name: 'Client A' }, recording: { url: 'https://app.onetab.ai/recordings/audio/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_TRANSCRIPT_READY',
    name: 'Voice Transcript Ready',
    category: 'VOICE',
    description: 'Notification when voice speech recognition transcript finishes.',
    subject: 'Voice call transcript ready: {{caller.name}}',
    previewText: 'Full transcript generated from voice audio.',
    htmlBody: `
      ${EmailHeading('Voice Transcript Ready')}
      ${EmailText('The automated speech-to-text transcript for your call with <strong>{{caller.name}}</strong> is ready.')}
      ${EmailButton('Read Full Transcript', '{{transcript.url || call.url}}')}
    `,
    textBody: `Voice transcript ready for {{caller.name}}.\n\nRead: {{transcript.url}}`,
    variablesSchema: {
      variables: [{ name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Client A' }],
      samplePayload: { caller: { name: 'Client A' }, transcript: { url: 'https://app.onetab.ai/transcripts/voice/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_SUMMARY_READY',
    name: 'Voice Call Summary Ready',
    category: 'VOICE',
    description: 'AI-generated bulleted key points and sentiment from call.',
    subject: 'Call Summary & Insights: {{caller.name}}',
    previewText: 'AI summary of voice conversation.',
    htmlBody: `
      ${EmailHeading('Voice Call Summary & Insights')}
      ${EmailText('AI synthesis for call with <strong>{{caller.name}}</strong>:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; line-height: 1.6;">
        {{call.summary}}
      </div>
      ${EmailButton('View Call Log', '{{call.url}}')}
    `,
    textBody: `Call Summary: {{caller.name}}\n\n{{call.summary}}\n\nView: {{call.url}}`,
    variablesSchema: {
      variables: [
        { name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Alex' },
        { name: 'call.summary', type: 'string', description: 'Summary', sampleValue: 'Discussed onboarding flow and agreed on timelines.' },
      ],
      samplePayload: { caller: { name: 'Alex' }, call: { summary: 'Discussed onboarding flow.', url: 'https://app.onetab.ai/voice/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'VOICE_FOLLOWUP_REQUIRED',
    name: 'Follow-up Required from Call',
    category: 'VOICE',
    description: 'Notification triggered when call analysis identifies commitments or follow-ups.',
    subject: 'Action required: Follow up on call with {{caller.name}}',
    previewText: 'Follow-up tasks identified from your voice call.',
    htmlBody: `
      ${EmailHeading('Follow-up Required')}
      ${EmailAlert('During your voice call with {{caller.name}}, following follow-up points were noted:', 'warning')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border-left: 3px solid #f59e0b; font-size: 13px;">
        {{followupDetails}}
      </div>
      ${EmailButton('Log Follow-up Task', '{{tasksUrl || "http://localhost:4200/tasks"}}')}
    `,
    textBody: `Follow-up required from call with {{caller.name}}:\n\n{{followupDetails}}\n\nLog task: {{tasksUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'caller.name', type: 'string', description: 'Caller', sampleValue: 'Alex' },
        { name: 'followupDetails', type: 'string', description: 'Details', sampleValue: 'Send proposal document by EOD' },
      ],
      samplePayload: { caller: { name: 'Alex' }, followupDetails: 'Send proposal by EOD', tasksUrl: 'https://app.onetab.ai/tasks' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
