import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const HIRE_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'HIRE_APPLICATION_RECEIVED',
    name: 'Application Received',
    category: 'HIRE',
    description: 'Confirmation email sent to candidate upon submitting application.',
    subject: 'We received your application for {{job.title}} at {{company.name || workspace.name}}',
    previewText: 'Thank you for applying. We are reviewing your profile.',
    htmlBody: `
      ${EmailHeading('Application Received')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailText('Thank you for applying for the position of <strong>{{job.title}}</strong> at <strong>{{company.name || workspace.name}}</strong>.')}
      ${EmailText('Our hiring team is currently reviewing your application. If your qualifications match our current needs, we will reach out with next steps.')}
    `,
    textBody: `Application Received\n\nHi {{candidate.firstName || "there"}},\n\nThank you for applying for {{job.title}} at {{company.name || workspace.name}}. We are reviewing your application.`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'First name', sampleValue: 'Jordan' },
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Senior Frontend Engineer' },
        { name: 'company.name', type: 'string', description: 'Company name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, job: { title: 'Senior Frontend Engineer' }, company: { name: 'Acme Corp' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_CANDIDATE_SHORTLISTED',
    name: 'Candidate Shortlisted',
    category: 'HIRE',
    description: 'Internal alert to recruiter/team that a candidate passed initial screen.',
    subject: 'Candidate shortlisted: {{candidate.name}} for {{job.title}}',
    previewText: '{{candidate.name}} was moved to the interview stage.',
    htmlBody: `
      ${EmailHeading('Candidate Shortlisted')}
      ${EmailText('<strong>{{candidate.name}}</strong> was moved to the shortlisted stage for <strong>{{job.title}}</strong>.')}
      ${EmailButton('View Candidate Profile', '{{candidate.url || "http://localhost:4200"}}')}
    `,
    textBody: `Candidate shortlisted: {{candidate.name}} for {{job.title}}.\n\nView: {{candidate.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.name', type: 'string', description: 'Candidate name', sampleValue: 'Jordan Smith' },
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Senior Engineer' },
      ],
      samplePayload: { candidate: { name: 'Jordan Smith', url: 'https://app.onetab.ai/hire/1' }, job: { title: 'Senior Engineer' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_CANDIDATE_REJECTED',
    name: 'Candidate Rejection Notice',
    category: 'HIRE',
    description: 'Polite rejection notice sent to candidate.',
    subject: 'Update on your application for {{job.title}} at {{company.name || workspace.name}}',
    previewText: 'Thank you for your interest in {{company.name}}.',
    htmlBody: `
      ${EmailHeading('Update on your application')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailText('Thank you for taking the time to speak with us and apply for <strong>{{job.title}}</strong> at <strong>{{company.name || workspace.name}}</strong>.')}
      ${EmailText('While we were impressed by your background, we have chosen to move forward with other candidates whose experience more closely matches our immediate requirements.')}
      ${EmailText('We wish you the best in your career search and hope to stay in touch for future openings.')}
    `,
    textBody: `Update on your application for {{job.title}}\n\nHi {{candidate.firstName || "there"}},\n\nThank you for your time and interest. We have decided to move forward with other candidates. We wish you the best.`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'Candidate name', sampleValue: 'Jordan' },
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Senior Engineer' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, job: { title: 'Senior Engineer' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_INTERVIEW_INVITATION',
    name: 'Interview Invitation',
    category: 'HIRE',
    description: 'Sent to candidate inviting them to schedule an interview.',
    subject: 'Interview with {{company.name || workspace.name}} for {{job.title}}',
    previewText: 'Invitation to interview for {{job.title}}.',
    htmlBody: `
      ${EmailHeading('Interview Invitation')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailText('We would love to invite you for an interview for the <strong>{{job.title}}</strong> role.')}
      ${EmailText('Please click the button below to pick a time slot that works best for your schedule:')}
      ${EmailButton('Schedule Interview', '{{scheduling.url || "http://localhost:4200"}}')}
    `,
    textBody: `Interview Invitation for {{job.title}}\n\nHi {{candidate.firstName || "there"}},\n\nPlease pick an interview time slot here: {{scheduling.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'Candidate name', sampleValue: 'Jordan' },
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Product Designer' },
        { name: 'scheduling.url', type: 'url', description: 'Calendar scheduling link' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, job: { title: 'Product Designer' }, scheduling: { url: 'https://app.onetab.ai/schedule/jordan' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_INTERVIEW_REMINDER',
    name: 'Interview Reminder',
    category: 'HIRE',
    description: 'Reminder sent 24 hours / 1 hour before scheduled interview.',
    subject: 'Interview Reminder: {{job.title}} interview on {{interview.date}}',
    previewText: 'Upcoming interview with {{interviewer.name || "the hiring team"}}.',
    htmlBody: `
      ${EmailHeading('Interview Reminder')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailCard([
        { label: 'Position', value: '{{job.title}}' },
        { label: 'Date & Time', value: '{{interview.date}} at {{interview.time}}' },
        { label: 'Interviewer', value: '{{interviewer.name || "Hiring Team"}}' },
      ])}
      ${EmailButton('Join Interview Room', '{{interview.url || "http://localhost:4200"}}')}
    `,
    textBody: `Interview Reminder: {{job.title}}\nDate: {{interview.date}} at {{interview.time}}\n\nJoin: {{interview.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'First name', sampleValue: 'Jordan' },
        { name: 'interview.date', type: 'string', description: 'Date', sampleValue: 'Oct 15, 2026' },
        { name: 'interview.time', type: 'string', description: 'Time', sampleValue: '2:00 PM' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, job: { title: 'Product Designer' }, interview: { date: 'Oct 15', time: '2:00 PM', url: 'https://app.onetab.ai/meet/hire' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_INTERVIEW_RESCHEDULED',
    name: 'Interview Rescheduled',
    category: 'HIRE',
    description: 'Notice when an interview time is modified.',
    subject: 'Rescheduled: {{job.title}} interview with {{company.name}}',
    previewText: 'New date and time for your interview.',
    htmlBody: `
      ${EmailHeading('Interview Rescheduled')}
      ${EmailText('Your interview for <strong>{{job.title}}</strong> has been updated to:')}
      ${EmailCard([
        { label: 'New Date', value: '{{interview.date}}' },
        { label: 'New Time', value: '{{interview.time}}' },
      ])}
      ${EmailButton('View Updated Details', '{{interview.url}}')}
    `,
    textBody: `Interview Rescheduled: {{job.title}}\nNew time: {{interview.date}} at {{interview.time}}\n\nView: {{interview.url}}`,
    variablesSchema: {
      variables: [
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Product Designer' },
        { name: 'interview.date', type: 'string', description: 'Date', sampleValue: 'Friday, Oct 16' },
      ],
      samplePayload: { job: { title: 'Product Designer' }, interview: { date: 'Oct 16', time: '3:00 PM', url: 'https://app.onetab.ai/meet/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_INTERVIEW_CANCELLED',
    name: 'Interview Cancelled',
    category: 'HIRE',
    description: 'Notice when an interview session is cancelled.',
    subject: 'Cancelled: {{job.title}} interview',
    previewText: 'Your scheduled interview has been cancelled.',
    htmlBody: `
      ${EmailHeading('Interview Cancelled')}
      ${EmailAlert('Your interview for {{job.title}} has been cancelled.', 'warning')}
      ${EmailText('Reason: {{cancelReason || "Cancelled by recruiter"}}')}
      ${EmailText('We will follow up with you regarding next steps or rescheduling.')}
    `,
    textBody: `Your interview for {{job.title}} has been cancelled.\nReason: {{cancelReason}}`,
    variablesSchema: {
      variables: [{ name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Product Designer' }],
      samplePayload: { job: { title: 'Product Designer' }, cancelReason: 'Interviewer emergency' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_INTERVIEW_FEEDBACK_REQUEST',
    name: 'Interview Feedback Request',
    category: 'HIRE',
    description: 'Sent to interviewers asking them to submit evaluation scorecards.',
    subject: 'Feedback needed for {{candidate.name}} ({{job.title}})',
    previewText: 'Please submit your interview scorecard.',
    htmlBody: `
      ${EmailHeading('Feedback Required')}
      ${EmailText('Please submit your interview scorecard for <strong>{{candidate.name}}</strong>.')}
      ${EmailButton('Submit Scorecard', '{{scorecard.url || "http://localhost:4200"}}')}
    `,
    textBody: `Please submit your scorecard for {{candidate.name}} ({{job.title}}).\n\nSubmit: {{scorecard.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.name', type: 'string', description: 'Candidate name', sampleValue: 'Jordan Smith' },
        { name: 'job.title', type: 'string', description: 'Job title', sampleValue: 'Engineer' },
      ],
      samplePayload: { candidate: { name: 'Jordan Smith' }, job: { title: 'Engineer' }, scorecard: { url: 'https://app.onetab.ai/hire/scorecard/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_CANDIDATE_SELECTED',
    name: 'Candidate Selected for Offer',
    category: 'HIRE',
    description: 'Internal notice that team approved hiring the candidate.',
    subject: 'Candidate Selected: Offer preparation for {{candidate.name}}',
    previewText: '{{candidate.name}} has been selected for {{job.title}}.',
    htmlBody: `
      ${EmailHeading('Candidate Selected 🎉')}
      ${EmailAlert('{{candidate.name}} has passed all interviews and was approved for an offer.', 'success')}
      ${EmailButton('Prepare Offer Letter', '{{offer.url || "http://localhost:4200"}}')}
    `,
    textBody: `Candidate Selected: {{candidate.name}} for {{job.title}}!\n\nPrepare offer: {{offer.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.name', type: 'string', description: 'Candidate', sampleValue: 'Jordan Smith' },
        { name: 'job.title', type: 'string', description: 'Role', sampleValue: 'Senior Engineer' },
      ],
      samplePayload: { candidate: { name: 'Jordan Smith' }, job: { title: 'Senior Engineer' }, offer: { url: 'https://app.onetab.ai/hire/offers/new' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_OFFER_SENT',
    name: 'Job Offer Sent to Candidate',
    category: 'HIRE',
    description: 'Formal job offer email sent to candidate with offer link/document.',
    subject: 'Job Offer: {{job.title}} at {{company.name || workspace.name}}!',
    previewText: 'Congratulations! We are delighted to extend an offer.',
    htmlBody: `
      ${EmailHeading('Congratulations! Job Offer Extended 🎉')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailText('We are thrilled to extend an offer for the position of <strong>{{job.title}}</strong> at <strong>{{company.name || workspace.name}}</strong>.')}
      ${EmailCard([
        { label: 'Role', value: '{{job.title}}' },
        { label: 'Start Date', value: '{{offer.startDate || "Flexible"}}' },
        { label: 'Offer Expires', value: '{{formatDate offer.expiresAt}}' },
      ])}
      ${EmailButton('View Official Offer Letter', '{{offer.url || "http://localhost:4200"}}')}
    `,
    textBody: `Congratulations! Job Offer for {{job.title}} at {{company.name || workspace.name}}!\n\nView offer: {{offer.url}}\nExpires: {{formatDate offer.expiresAt}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'First name', sampleValue: 'Jordan' },
        { name: 'job.title', type: 'string', description: 'Role', sampleValue: 'Lead Engineer' },
        { name: 'offer.expiresAt', type: 'date', description: 'Expiration date', sampleValue: '2026-10-20T00:00:00Z' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, job: { title: 'Lead Engineer' }, offer: { expiresAt: '2026-10-20T00:00:00Z', url: 'https://app.onetab.ai/offer/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_OFFER_ACCEPTED',
    name: 'Job Offer Accepted',
    category: 'HIRE',
    description: 'Notification to hiring team that candidate signed the offer.',
    subject: 'Offer Accepted! {{candidate.name}} is joining as {{job.title}}',
    previewText: '{{candidate.name}} accepted the offer!',
    htmlBody: `
      ${EmailHeading('Offer Accepted! 🎉')}
      ${EmailAlert('{{candidate.name}} has signed the offer letter for {{job.title}}!', 'success')}
      ${EmailText('Start date: <strong>{{offer.startDate || "To be confirmed"}}</strong>')}
      ${EmailButton('View Candidate Record', '{{candidate.url || "http://localhost:4200"}}')}
    `,
    textBody: `Offer Accepted! {{candidate.name}} signed for {{job.title}}!\n\nStart date: {{offer.startDate}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.name', type: 'string', description: 'Candidate', sampleValue: 'Jordan Smith' },
        { name: 'job.title', type: 'string', description: 'Role', sampleValue: 'Lead Engineer' },
      ],
      samplePayload: { candidate: { name: 'Jordan Smith' }, job: { title: 'Lead Engineer' }, offer: { startDate: 'Nov 1, 2026' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_OFFER_DECLINED',
    name: 'Job Offer Declined',
    category: 'HIRE',
    description: 'Notification to hiring team that candidate declined offer.',
    subject: 'Offer Declined: {{candidate.name}} for {{job.title}}',
    previewText: '{{candidate.name}} declined the job offer.',
    htmlBody: `
      ${EmailHeading('Offer Declined')}
      ${EmailAlert('{{candidate.name}} declined the job offer for {{job.title}}.', 'warning')}
      ${EmailText('Feedback / Reason: {{declineReason || "Accepted counter-offer or alternative role"}}')}
    `,
    textBody: `Offer Declined: {{candidate.name}} for {{job.title}}.\nReason: {{declineReason}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.name', type: 'string', description: 'Candidate', sampleValue: 'Jordan Smith' },
        { name: 'job.title', type: 'string', description: 'Role', sampleValue: 'Lead Engineer' },
      ],
      samplePayload: { candidate: { name: 'Jordan Smith' }, job: { title: 'Lead Engineer' }, declineReason: 'Accepted alternative offer' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'HIRE_ONBOARDING_INVITATION',
    name: 'Candidate Onboarding Invitation',
    category: 'HIRE',
    description: 'Welcome email sent prior to start date with portal access.',
    subject: 'Welcome to the team! Onboarding instructions for {{company.name}}',
    previewText: 'Get set up before your first day.',
    htmlBody: `
      ${EmailHeading('Welcome to {{company.name || workspace.name}}! 🚀')}
      ${EmailText('Hi {{candidate.firstName || "there"}},')}
      ${EmailText('We are excited to welcome you. Click below to complete your pre-onboarding paperwork and set up your workspace profile:')}
      ${EmailButton('Start Onboarding', '{{onboarding.url || "http://localhost:4200"}}')}
    `,
    textBody: `Welcome to the team, {{candidate.firstName || "there"}}!\n\nStart onboarding: {{onboarding.url}}`,
    variablesSchema: {
      variables: [
        { name: 'candidate.firstName', type: 'string', description: 'First name', sampleValue: 'Jordan' },
        { name: 'company.name', type: 'string', description: 'Company name', sampleValue: 'Acme Corp' },
      ],
      samplePayload: { candidate: { firstName: 'Jordan' }, company: { name: 'Acme Corp' }, onboarding: { url: 'https://app.onetab.ai/onboard/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
