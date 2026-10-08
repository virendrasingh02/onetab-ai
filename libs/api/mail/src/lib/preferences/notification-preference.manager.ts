import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@org/database';

export interface CanSendEmailOptions {
  templateKey: string;
  userId?: string | null;
  workspaceId?: string | null;
  channelId?: string | null;
  forceSend?: boolean;
}

export interface CanSendEmailResult {
  shouldSend: boolean;
  isMandatory: boolean;
  reason?: string;
}

const MANDATORY_PREFIXES = ['AUTH_', 'SECURITY_'];
const MANDATORY_KEYS = new Set([
  'WORKSPACE_INVITATION',
  'WORKSPACE_INVITATION_REMINDER',
  'WORKSPACE_OWNERSHIP_TRANSFERRED',
  'WORKSPACE_DEACTIVATED',
  'BILLING_PAYMENT_FAILED',
  'BILLING_INVOICE_OVERDUE',
  'SYSTEM_SERVICE_INTERRUPTION',
  'SYSTEM_TERMS_UPDATE',
  'SYSTEM_PRIVACY_UPDATE',
  'SYSTEM_COMPLIANCE_NOTIFICATION',
]);

@Injectable()
export class NotificationPreferenceManager {
  private readonly logger = new Logger(NotificationPreferenceManager.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Evaluates if a transactional template is mandatory or subject to user notification settings.
   */
  isMandatorySecurityEmail(templateKey: string): boolean {
    const key = templateKey.toUpperCase().trim();
    if (MANDATORY_KEYS.has(key)) return true;
    for (const prefix of MANDATORY_PREFIXES) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  /**
   * Checks whether the email can be delivered to the recipient.
   */
  async canSendEmail(options: CanSendEmailOptions): Promise<CanSendEmailResult> {
    const { templateKey, userId, workspaceId, channelId, forceSend } = options;
    const isMandatory = this.isMandatorySecurityEmail(templateKey);

    // Mandatory emails (auth, OTP, security, critical billing/system) ALWAYS send
    if (isMandatory || forceSend) {
      return { shouldSend: true, isMandatory: true };
    }

    // If no userId is provided, treat as system transactional and send
    if (!userId) {
      return { shouldSend: true, isMandatory: false };
    }

    // Check user & workspace notification preferences in database
    if (this.prisma && workspaceId) {
      try {
        const pref = await this.prisma.notificationPreference.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId,
            },
          },
        });

        if (pref) {
          // If user specifically turned off email notifications for this workspace
          if (pref.emailEnabled === false) {
            this.logger.debug(`Suppressed non-mandatory email ${templateKey} for user ${userId} in workspace ${workspaceId}: email notifications disabled.`);
            return {
              shouldSend: false,
              isMandatory: false,
              reason: 'USER_DISABLED_WORKSPACE_EMAILS',
            };
          }

          // Check if channel is muted
          if (channelId && pref.mutedChannelIds?.includes(channelId)) {
            return {
              shouldSend: false,
              isMandatory: false,
              reason: 'CHANNEL_MUTED',
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to query notification preferences: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { shouldSend: true, isMandatory: false };
  }
}
