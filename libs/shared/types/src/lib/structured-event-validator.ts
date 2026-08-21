import type {
  AIAgentMessageContent,
  AppResponseMessageContent,
  ApprovalMessageContent,
  FileMessageContent,
  FormMessageContent,
  StructuredChatMessage,
  SystemMessageContent,
  WorkflowMessageContent,
} from './chat.js';
import type { CardMessageContent } from './card-schema.js';

export interface ValidationResult<T extends StructuredChatMessage = StructuredChatMessage> {
  valid: boolean;
  event?: T;
  error?: string;
}

/**
 * Validates and normalizes structured chat event payloads.
 * Supports legacy `mie.*` types, versioned `mie.*.v1` types, and `org.onetab.*` extensions.
 */
export function validateStructuredEvent(
  raw: unknown,
): ValidationResult<StructuredChatMessage> {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Event payload must be a non-null object' };
  }

  const obj = raw as Record<string, unknown>;
  const rawType = String(obj['type'] || obj['msgtype'] || obj['eventType'] || '');

  // Normalize type
  let type = rawType;
  if (type.startsWith('mie.ai.agent') || type.startsWith('org.onetab.ai.agent')) {
    type = 'mie.ai.agent';
  } else if (type.startsWith('mie.approval') || type.startsWith('org.onetab.approval')) {
    type = 'mie.approval';
  } else if (type.startsWith('mie.app.response') || type.startsWith('org.onetab.app.response') || type === 'mie.app' || type.startsWith('mie.app.') || type.startsWith('org.onetab.app.')) {
    type = 'mie.app.response';
  } else if (type.startsWith('mie.form') || type.startsWith('org.onetab.form')) {
    type = 'mie.form';
  } else if (type.startsWith('mie.file') || type.startsWith('org.onetab.file')) {
    type = 'mie.file';
  } else if (type.startsWith('mie.workflow') || type.startsWith('org.onetab.workflow')) {
    type = 'mie.workflow';
  } else if (type.startsWith('mie.system') || type.startsWith('org.onetab.system')) {
    type = 'mie.system';
  } else if (type.startsWith('mie.card') || type.startsWith('org.onetab.card')) {
    type = 'mie.card';
  }

  switch (type) {
    case 'mie.ai.agent':
      return validateAIAgentEvent(obj);
    case 'mie.app.response':
      return validateAppResponseEvent(obj);
    case 'mie.approval':
      return validateApprovalEvent(obj);
    case 'mie.form':
      return validateFormEvent(obj);
    case 'mie.file':
      return validateFileEvent(obj);
    case 'mie.workflow':
      return validateWorkflowEvent(obj);
    case 'mie.system':
      return validateSystemEvent(obj);
    case 'mie.card':
      return validateCardEvent(obj);
    default:
      return { valid: false, error: `Unrecognized structured event type: "${rawType}"` };
  }
}

function validateAIAgentEvent(obj: Record<string, unknown>): ValidationResult<AIAgentMessageContent> {
  const agentId = String(obj['agentId'] || obj['senderId'] || 'unknown-agent');
  const validStatuses = [
    'queued',
    'starting',
    'running',
    'waiting',
    'waiting_for_approval',
    'completed',
    'failed',
    'cancelled',
    'paused',
  ];
  const rawStatus = String(obj['status'] || 'completed').toLowerCase();
  const status = (validStatuses.includes(rawStatus) ? rawStatus : 'completed') as AIAgentMessageContent['status'];

  const event: AIAgentMessageContent = {
    type: 'mie.ai.agent',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    agentId,
    executionId: typeof obj['executionId'] === 'string' ? obj['executionId'] : undefined,
    status,
    title: typeof obj['title'] === 'string' ? obj['title'] : undefined,
    agentName: typeof obj['agentName'] === 'string' ? obj['agentName'] : typeof obj['senderName'] === 'string' ? obj['senderName'] : undefined,
    agentHandle: typeof obj['agentHandle'] === 'string' ? obj['agentHandle'] : undefined,
    agentAvatarSeed: typeof obj['agentAvatarSeed'] === 'string' ? obj['agentAvatarSeed'] : undefined,
    agentAvatarUrl: typeof obj['agentAvatarUrl'] === 'string' ? obj['agentAvatarUrl'] : undefined,
    agentRole: typeof obj['agentRole'] === 'string' ? obj['agentRole'] : undefined,
    agentDescription: typeof obj['agentDescription'] === 'string' ? obj['agentDescription'] : undefined,
    workspaceId: typeof obj['workspaceId'] === 'string' ? obj['workspaceId'] : undefined,
    teamName: typeof obj['teamName'] === 'string' ? obj['teamName'] : undefined,
    model: typeof obj['model'] === 'string' ? obj['model'] : undefined,
    durationMs: typeof obj['durationMs'] === 'number' ? obj['durationMs'] : undefined,
    startedAt: typeof obj['startedAt'] === 'number' ? obj['startedAt'] : undefined,
    completedAt: typeof obj['completedAt'] === 'number' ? obj['completedAt'] : undefined,
    summary: typeof obj['summary'] === 'string' ? obj['summary'] : undefined,
    responseText: typeof obj['responseText'] === 'string' ? obj['responseText'] : typeof obj['content'] === 'string' ? obj['content'] : undefined,
    reasoning: obj['reasoning'] && typeof obj['reasoning'] === 'object' ? (obj['reasoning'] as AIAgentMessageContent['reasoning']) : undefined,
    keyFindings: Array.isArray(obj['keyFindings']) ? obj['keyFindings'].map(String) : undefined,
    actionsTaken: Array.isArray(obj['actionsTaken']) ? obj['actionsTaken'].map(String) : undefined,
    tools: Array.isArray(obj['tools']) ? (obj['tools'] as any) : Array.isArray(obj['toolsExecuted']) ? (obj['toolsExecuted'] as any) : undefined,
    sources: Array.isArray(obj['sources']) ? (obj['sources'] as any) : undefined,
    files: Array.isArray(obj['files']) ? (obj['files'] as any) : undefined,
    suggestedActions: Array.isArray(obj['suggestedActions']) ? (obj['suggestedActions'] as any) : undefined,
    actions: Array.isArray(obj['actions']) ? (obj['actions'] as any) : undefined,
    errorMessage: typeof obj['errorMessage'] === 'string' ? obj['errorMessage'] : undefined,
    metadata: obj['metadata'] && typeof obj['metadata'] === 'object' ? (obj['metadata'] as Record<string, unknown>) : undefined,
  };

  return { valid: true, event };
}

function validateAppResponseEvent(obj: Record<string, unknown>): ValidationResult<AppResponseMessageContent> {
  const appId = String(obj['appId'] || obj['senderId'] || 'custom-app');
  const appName = String(obj['appName'] || obj['senderName'] || 'App');
  const title = String(obj['title'] || (obj['embedCard'] as any)?.title || 'App Response');

  const event: AppResponseMessageContent = {
    type: 'mie.app.response',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    appId,
    appName,
    appIcon: typeof obj['appIcon'] === 'string' ? obj['appIcon'] : typeof obj['senderAvatarSeed'] === 'string' ? obj['senderAvatarSeed'] : undefined,
    category: obj['category'] as any,
    eventType: typeof obj['eventType'] === 'string' ? obj['eventType'] : 'app.event',
    cardType: (obj['cardType'] || (obj['embedCard'] as any)?.type) as any,
    title,
    subtitle: typeof obj['subtitle'] === 'string' ? obj['subtitle'] : undefined,
    url: typeof obj['url'] === 'string' ? obj['url'] : (obj['embedCard'] as any)?.url,
    accentColor: typeof obj['accentColor'] === 'string' ? obj['accentColor'] : (obj['embedCard'] as any)?.accentColor,
    badge: obj['badge'] as any,
    fields: Array.isArray(obj['fields']) ? (obj['fields'] as any) : Array.isArray((obj['embedCard'] as any)?.fields) ? ((obj['embedCard'] as any)?.fields as any) : undefined,
    data: obj['data'] && typeof obj['data'] === 'object' ? (obj['data'] as Record<string, unknown>) : undefined,
    actions: Array.isArray(obj['actions']) ? (obj['actions'] as any) : undefined,
    footer: typeof obj['footer'] === 'string' ? obj['footer'] : (obj['embedCard'] as any)?.footer,
    timestamp: typeof obj['timestamp'] === 'number' ? obj['timestamp'] : undefined,
  };

  return { valid: true, event };
}

function validateApprovalEvent(obj: Record<string, unknown>): ValidationResult<ApprovalMessageContent> {
  const approvalId = String(obj['approvalId'] || obj['id'] || `approval-${Date.now()}`);
  const title = String(obj['title'] || 'Approval Required');
  const description = String(obj['description'] || '');
  const rawStatus = String(obj['status'] || 'pending').toLowerCase();
  const validStatuses = ['pending', 'approved', 'rejected', 'expired', 'cancelled'];
  const status = (validStatuses.includes(rawStatus) ? rawStatus : 'pending') as ApprovalMessageContent['status'];

  const event: ApprovalMessageContent = {
    type: 'mie.approval',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    approvalId,
    title,
    description,
    agentId: typeof obj['agentId'] === 'string' ? obj['agentId'] : undefined,
    agentName: typeof obj['agentName'] === 'string' ? obj['agentName'] : undefined,
    status,
    riskLevel: (obj['riskLevel'] || 'medium') as any,
    sideEffects: Array.isArray(obj['sideEffects']) ? obj['sideEffects'].map(String) : undefined,
    proposedAction: typeof obj['proposedAction'] === 'string' ? obj['proposedAction'] : undefined,
    diffPreview: obj['diffPreview'] && typeof obj['diffPreview'] === 'object' ? (obj['diffPreview'] as any) : undefined,
    approverId: typeof obj['approverId'] === 'string' ? obj['approverId'] : undefined,
    approverName: typeof obj['approverName'] === 'string' ? obj['approverName'] : undefined,
    decidedAt: typeof obj['decidedAt'] === 'number' ? obj['decidedAt'] : undefined,
    expiresAt: typeof obj['expiresAt'] === 'number' ? obj['expiresAt'] : undefined,
    payload: obj['payload'] && typeof obj['payload'] === 'object' ? (obj['payload'] as Record<string, unknown>) : undefined,
    actions: Array.isArray(obj['actions']) ? (obj['actions'] as any) : undefined,
  };

  return { valid: true, event };
}

function validateFormEvent(obj: Record<string, unknown>): ValidationResult<FormMessageContent> {
  const formId = String(obj['formId'] || obj['id'] || `form-${Date.now()}`);
  const title = String(obj['title'] || 'Form');
  const fields = Array.isArray(obj['fields']) ? (obj['fields'] as any) : [];

  const event: FormMessageContent = {
    type: 'mie.form',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    formId,
    title,
    description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
    fields,
    submitLabel: typeof obj['submitLabel'] === 'string' ? obj['submitLabel'] : 'Submit',
    cancelLabel: typeof obj['cancelLabel'] === 'string' ? obj['cancelLabel'] : 'Cancel',
    status: (obj['status'] || 'idle') as any,
    submittedValues: obj['submittedValues'] && typeof obj['submittedValues'] === 'object' ? (obj['submittedValues'] as Record<string, unknown>) : undefined,
    submittedAt: typeof obj['submittedAt'] === 'number' ? obj['submittedAt'] : undefined,
    submittedBy: typeof obj['submittedBy'] === 'string' ? obj['submittedBy'] : undefined,
  };

  return { valid: true, event };
}

function validateFileEvent(obj: Record<string, unknown>): ValidationResult<FileMessageContent> {
  const files = Array.isArray(obj['files']) ? (obj['files'] as any) : [];
  const event: FileMessageContent = {
    type: 'mie.file',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    fileId: typeof obj['fileId'] === 'string' ? obj['fileId'] : undefined,
    title: typeof obj['title'] === 'string' ? obj['title'] : 'Generated Files',
    description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
    files,
  };
  return { valid: true, event };
}

function validateWorkflowEvent(obj: Record<string, unknown>): ValidationResult<WorkflowMessageContent> {
  const workflowId = String(obj['workflowId'] || obj['id'] || `workflow-${Date.now()}`);
  const title = String(obj['title'] || 'Workflow Execution');
  const steps = Array.isArray(obj['steps']) ? (obj['steps'] as any) : [];
  const currentStepIndex = typeof obj['currentStepIndex'] === 'number' ? obj['currentStepIndex'] : 0;

  const event: WorkflowMessageContent = {
    type: 'mie.workflow',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    workflowId,
    title,
    description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
    currentStepIndex,
    totalSteps: typeof obj['totalSteps'] === 'number' ? obj['totalSteps'] : steps.length,
    status: (obj['status'] || 'running') as any,
    steps,
    durationMs: typeof obj['durationMs'] === 'number' ? obj['durationMs'] : undefined,
    startedAt: typeof obj['startedAt'] === 'number' ? obj['startedAt'] : undefined,
    completedAt: typeof obj['completedAt'] === 'number' ? obj['completedAt'] : undefined,
    actions: Array.isArray(obj['actions']) ? (obj['actions'] as any) : undefined,
  };

  return { valid: true, event };
}

function validateSystemEvent(obj: Record<string, unknown>): ValidationResult<SystemMessageContent> {
  const title = String(obj['title'] || 'System Notification');
  const rawSeverity = String(obj['severity'] || 'info').toLowerCase();
  const validSeverities = ['info', 'success', 'warning', 'error'];
  const severity = (validSeverities.includes(rawSeverity) ? rawSeverity : 'info') as SystemMessageContent['severity'];

  const event: SystemMessageContent = {
    type: 'mie.system',
    version: typeof obj['version'] === 'string' ? obj['version'] : 'v1',
    severity,
    title,
    details: typeof obj['details'] === 'string' ? obj['details'] : undefined,
    code: typeof obj['code'] === 'string' ? obj['code'] : undefined,
    timestamp: typeof obj['timestamp'] === 'number' ? obj['timestamp'] : Date.now(),
    actions: Array.isArray(obj['actions']) ? (obj['actions'] as any) : undefined,
  };

  return { valid: true, event };
}

function validateCardEvent(obj: Record<string, unknown>): ValidationResult<CardMessageContent> {
  const cardId = String(obj['cardId'] || obj['id'] || '');
  if (!cardId) {
    return { valid: false, error: 'Card event requires a valid cardId' };
  }
  const data = (obj['data'] && typeof obj['data'] === 'object') ? (obj['data'] as Record<string, unknown>) : {};
  const version = typeof obj['version'] === 'number' ? obj['version'] : typeof obj['version'] === 'string' ? parseInt(obj['version'], 10) || undefined : undefined;
  const actionResults = (obj['actionResults'] && typeof obj['actionResults'] === 'object') ? (obj['actionResults'] as Record<string, unknown>) : undefined;
  const fallbackSummary = typeof obj['fallbackSummary'] === 'string' ? obj['fallbackSummary'] : typeof obj['summary'] === 'string' ? obj['summary'] : undefined;

  const event: CardMessageContent = {
    type: 'mie.card',
    cardId,
    version,
    data,
    actionResults,
    fallbackSummary,
  };

  return { valid: true, event };
}
