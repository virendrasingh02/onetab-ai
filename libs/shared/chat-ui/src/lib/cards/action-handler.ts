import type { StructuredMessageAction } from '@org/types';
import { toast } from '@org/ui';

export interface ActionExecutionContext {
  roomId: string;
  messageId: string;
  senderId?: string;
  agentId?: string;
  appId?: string;
  userPermissions?: string[];
}

export type ActionExecutionResult = {
  success: boolean;
  message?: string;
  data?: unknown;
};

export type ActionHandlerFn = (
  action: StructuredMessageAction,
  context: ActionExecutionContext,
) => Promise<ActionExecutionResult | void> | ActionExecutionResult | void;

/** Sensitive action types that require explicit user confirmation */
const SENSITIVE_ACTION_TYPES = new Set([
  'delete',
  'delete_resource',
  'publish',
  'publish_content',
  'send_email',
  'crm_update',
  'crm_delete',
  'database_write',
  'workflow_execute_production',
  'external_api_call',
]);

/**
 * Checks if an action is considered sensitive and needs user confirmation.
 */
export function isActionSensitive(action: StructuredMessageAction): boolean {
  if (action.requiresConfirmation) return true;
  if (action.actionType && SENSITIVE_ACTION_TYPES.has(action.actionType.toLowerCase())) {
    return true;
  }
  if (action.variant === 'destructive') return true;
  return false;
}

/**
 * Default safe action execution layer.
 */
export async function executeStructuredAction(
  action: StructuredMessageAction,
  context: ActionExecutionContext,
  customHandler?: ActionHandlerFn,
): Promise<boolean> {
  if (action.disabled) {
    toast.info('This action is currently disabled.');
    return false;
  }

  // If action has a direct external URL, handle opening safely
  if (action.url) {
    window.open(action.url, '_blank', 'noopener,noreferrer');
    return true;
  }

  try {
    if (customHandler) {
      const res = await customHandler(action, context);
      if (res && typeof res === 'object' && res.success === false) {
        toast.error(res.message || `Failed to execute ${action.label}`);
        return false;
      }
    }

    toast.success(`Executed: "${action.label}"`);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Action execution failed';
    toast.error(errorMsg);
    return false;
  }
}
