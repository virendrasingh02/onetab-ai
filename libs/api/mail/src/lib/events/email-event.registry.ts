import { Injectable } from '@nestjs/common';

export interface EventMapping {
  eventName: string;
  templateKey: string;
  description: string;
}

export const PLATFORM_EVENT_MAPPINGS: Record<string, string> = {
  // Authentication events
  USER_REGISTERED: 'AUTH_WELCOME',
  OTP_REQUESTED: 'AUTH_OTP',
  OTP_RESENT: 'AUTH_RESEND_OTP',
  PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  EMAIL_VERIFICATION_REQUESTED: 'AUTH_EMAIL_VERIFICATION',
  MAGIC_LINK_REQUESTED: 'AUTH_MAGIC_LINK',
  NEW_DEVICE_LOGIN: 'AUTH_NEW_DEVICE_LOGIN',
  SUSPICIOUS_LOGIN_DETECTED: 'AUTH_SUSPICIOUS_LOGIN',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',

  // Workspace events
  WORKSPACE_INVITED: 'WORKSPACE_INVITATION',
  'workspace.invited': 'WORKSPACE_INVITATION',
  WORKSPACE_INVITATION_REMINDER: 'WORKSPACE_INVITATION_REMINDER',
  WORKSPACE_ROLE_CHANGED: 'WORKSPACE_ROLE_CHANGED',
  WORKSPACE_OWNERSHIP_TRANSFERRED: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
  MEMBER_JOINED: 'TEAM_MEMBER_JOINED',
  'member.joined': 'TEAM_MEMBER_JOINED',

  // Task & Project events
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  'task.assigned': 'TASK_ASSIGNED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  'task.completed': 'TASK_COMPLETED',
  TASK_OVERDUE: 'TASK_OVERDUE',
  'task.overdue': 'TASK_OVERDUE',
  TASK_DUE_SOON: 'TASK_DUE_SOON',
  PROJECT_CREATED: 'PROJECT_CREATED',
  'project.created': 'PROJECT_CREATED',

  // Meeting events
  MEETING_SCHEDULED: 'MEETING_INVITATION',
  'meeting.scheduled': 'MEETING_INVITATION',
  MEETING_CANCELLED: 'MEETING_CANCELLED',
  'meeting.cancelled': 'MEETING_CANCELLED',
  MEETING_UPDATED: 'MEETING_RESCHEDULED',
  'meeting.updated': 'MEETING_RESCHEDULED',
  MEETING_ENDED: 'MEETING_SUMMARY_AVAILABLE',
  'meeting.ended': 'MEETING_SUMMARY_AVAILABLE',

  // AI Agent events
  AI_APPROVAL_REQUESTED: 'AGENT_APPROVAL_REQUIRED',
  'ai.approval.requested': 'AGENT_APPROVAL_REQUIRED',
  AI_RUN_FINISHED: 'AGENT_EXECUTION_COMPLETED',
  'ai.run.finished': 'AGENT_EXECUTION_COMPLETED',
  COWORKER_FAILED: 'AGENT_EXECUTION_FAILED',
  'coworker.failed': 'AGENT_EXECUTION_FAILED',
  COWORKER_HANDOFF: 'AGENT_HANDOFF_HUMAN',
  'coworker.handoff': 'AGENT_HANDOFF_HUMAN',

  // Team & Collaboration events
  MENTION_CREATED: 'TEAM_USER_MENTIONED',
  'mention.created': 'TEAM_USER_MENTIONED',
  FILE_SHARED: 'TEAM_RESOURCE_SHARED',
  'file.shared': 'TEAM_RESOURCE_SHARED',
  DOCUMENT_CREATED: 'DOC_PUBLISHED',
  'document.created': 'DOC_PUBLISHED',

  // Billing events
  PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',
  PAYMENT_SUCCESSFUL: 'BILLING_PAYMENT_SUCCESSFUL',
  INVOICE_GENERATED: 'BILLING_INVOICE_GENERATED',
  SUBSCRIPTION_CANCELLED: 'BILLING_SUBSCRIPTION_CANCELLED',
};

@Injectable()
export class EmailEventRegistry {
  private readonly eventToTemplateMap = new Map<string, string>();

  constructor() {
    for (const [evt, tpl] of Object.entries(PLATFORM_EVENT_MAPPINGS)) {
      this.eventToTemplateMap.set(evt, tpl);
    }
  }

  getTemplateForEvent(eventName: string): string | undefined {
    return this.eventToTemplateMap.get(eventName) || this.eventToTemplateMap.get(eventName.toUpperCase());
  }

  registerEvent(eventName: string, templateKey: string): void {
    this.eventToTemplateMap.set(eventName, templateKey.toUpperCase());
  }

  listMappings(): EventMapping[] {
    return Array.from(this.eventToTemplateMap.entries()).map(([eventName, templateKey]) => ({
      eventName,
      templateKey,
      description: `Maps event ${eventName} to ${templateKey}`,
    }));
  }
}
