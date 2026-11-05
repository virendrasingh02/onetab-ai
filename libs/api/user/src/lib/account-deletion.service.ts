import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@org/api-auth';
import { IntegrationsService } from '@org/api-integrations';
import { MatrixAdminService } from '@org/api-matrix';
import { StorageService } from '@org/api-storage';
import { BillingService, WorkspaceService } from '@org/api-workspace';
import { PrismaService } from '@org/database';
import type { AccountDeletionPreview, AccountDeletionResult } from '@org/types';
import type { DeleteAccountInput } from '@org/validation';

/** What a scrubbed account reads as anywhere its old content is still shown. */
export const DELETED_USER_NAME = 'Deleted user';

/** `.invalid` is reserved (RFC 2606), so nothing can ever be mailed here. */
export function tombstoneEmail(userId: string): string {
  return `deleted+${userId}@deleted.invalid`;
}

/**
 * Self-service account deletion (App Store 5.1.1(v), Google Play account
 * deletion policy, GDPR Art. 17).
 *
 * It is immediate and cannot be undone. The `users` row survives only as a
 * personal-data-free tombstone: several tables reference it without a cascade,
 * and a real delete would cascade into comments and documents that belong to
 * the workspace. `deletedAt` shuts the account out even for a live access token
 * (see `JwtStrategy`).
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly workspaces: WorkspaceService,
    private readonly billing: BillingService,
    private readonly integrations: IntegrationsService,
    private readonly matrix: MatrixAdminService,
    private readonly storage: StorageService,
  ) {}

  /**
   * What deleting this account would do. A workspace other people use cannot
   * vanish with its owner, so those are returned as blockers to resolve first.
   */
  async preview(userId: string): Promise<AccountDeletionPreview> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        twoFactorAuth: { select: { isEnabled: true } },
        ownedWorkspaces: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('The account no longer exists.');

    const summary = (w: { id: string; name: string; slug: string }) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
    });
    return {
      requiresPassword: Boolean(user.passwordHash),
      requiresTwoFactor: Boolean(user.twoFactorAuth?.isEnabled),
      workspacesToTransfer: user.ownedWorkspaces
        .filter((w) => w._count.members > 1)
        .map(summary),
      workspacesToDelete: user.ownedWorkspaces
        .filter((w) => w._count.members <= 1)
        .map(summary),
    };
  }

  async deleteAccount(
    userId: string,
    input: DeleteAccountInput,
  ): Promise<AccountDeletionResult> {
    await this.auth.assertAccountOwnership(userId, input);

    const plan = await this.preview(userId);
    if (plan.workspacesToTransfer.length > 0) {
      throw new ConflictException({
        code: 'WORKSPACE_OWNERSHIP_REQUIRED',
        message: `Transfer ownership of ${plan.workspacesToTransfer
          .map((w) => w.name)
          .join(', ')} before deleting your account.`,
      });
    }

    // Billing first: a provider failure must stop everything, or the person
    // loses their account and keeps being charged.
    for (const workspace of plan.workspacesToDelete) {
      const subscription = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId: workspace.id },
        select: { providerSubscriptionId: true, cancelAtPeriodEnd: true },
      });
      if (
        subscription?.providerSubscriptionId &&
        !subscription.cancelAtPeriodEnd
      ) {
        await this.billing.cancelSubscription(workspace.id, userId);
      }
    }

    const integrationsRevoked = await this.revokeIntegrations(userId);
    const chatErased = await this.eraseMatrixIdentity(userId);

    for (const workspace of plan.workspacesToDelete) {
      await this.workspaces.remove(workspace.id, userId);
    }

    await this.scrub(userId);
    await this.removeProfileMedia(userId);

    this.logger.log({ event: 'account_deleted', userId, chatErased });
    return {
      deleted: true,
      chatErased,
      integrationsRevoked,
      workspacesDeleted: plan.workspacesToDelete.length,
    };
  }

  /** Provider-side revocation is best effort; the stored tokens go regardless. */
  private async revokeIntegrations(userId: string): Promise<number> {
    const connections = await this.prisma.externalIntegration.findMany({
      where: { userId },
      select: { id: true, workspaceId: true },
    });
    for (const connection of connections) {
      await this.integrations
        .disconnectIntegration(
          connection.id,
          userId,
          connection.workspaceId ?? undefined,
        )
        .catch((error: unknown) =>
          this.logger.warn({
            event: 'account_deletion_integration_revoke_failed',
            integrationId: connection.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }
    return connections.length;
  }

  /**
   * Chat lives on the homeserver, not in this database. `false` means the
   * erasure did not happen and an operator has to finish it: the Matrix id is
   * logged because the row loses it below.
   */
  private async eraseMatrixIdentity(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { matrixUserId: true },
    });
    if (!user?.matrixUserId) return true;
    try {
      return await this.matrix.deactivateUser(user.matrixUserId, {
        erase: true,
      });
    } catch (error) {
      this.logger.error({
        event: 'account_deletion_matrix_erase_failed',
        userId,
        matrixUserId: user.matrixUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /** One transaction: a crash must not leave a half-anonymised person. */
  private async scrub(userId: string): Promise<void> {
    const mine = { where: { userId } };
    const p = this.prisma;
    await p.$transaction([
      // Credentials and sessions.
      p.refreshToken.deleteMany(mine),
      p.passwordResetToken.deleteMany(mine),
      p.magicLinkToken.deleteMany(mine),
      p.emailVerificationToken.deleteMany(mine),
      p.twoFactorChallenge.deleteMany(mine),
      p.twoFactorAuth.deleteMany(mine),
      p.webAuthnCredential.deleteMany(mine),
      p.webAuthnChallenge.deleteMany(mine),
      p.userIdentity.deleteMany(mine),
      p.pushRegistration.deleteMany(mine),
      p.externalIntegration.deleteMany(mine),
      // Private to this person: nobody else ever saw these.
      p.notification.deleteMany({ where: { recipientId: userId } }),
      p.notificationPreference.deleteMany(mine),
      p.chatSettings.deleteMany(mine),
      p.sidebarPreference.deleteMany(mine),
      p.themeSetting.deleteMany(mine),
      p.navigationPreference.deleteMany(mine),
      p.scheduledStatus.deleteMany(mine),
      p.scheduledMessage.deleteMany({ where: { authorId: userId } }),
      p.messageReminder.deleteMany(mine),
      p.workspaceThemePreference.deleteMany(mine),
      p.workspaceMemberPreference.deleteMany(mine),
      p.bookmark.deleteMany(mine),
      p.attentionItemState.deleteMany(mine),
      p.recentActivity.deleteMany(mine),
      p.userNameAlias.deleteMany(mine),
      p.aIChatSession.deleteMany(mine),
      p.agentConversation.deleteMany(mine),
      p.userBlock.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      // Membership.
      p.employeeProfile.deleteMany(mine),
      p.sCIMGroupMember.deleteMany(mine),
      p.channelMember.deleteMany(mine),
      p.workspaceMember.deleteMany(mine),
      // The tombstone.
      p.user.update({
        where: { id: userId },
        data: {
          email: tombstoneEmail(userId),
          passwordHash: null,
          name: DELETED_USER_NAME,
          displayName: null,
          username: null,
          avatarUrl: null,
          bio: null,
          jobTitle: null,
          location: null,
          website: null,
          github: null,
          coverUrl: null,
          timezone: 'UTC',
          statusText: null,
          statusEmoji: null,
          statusExpiresAt: null,
          scheduledStatusAppliedId: null,
          emailVerifiedAt: null,
          lastSeenAt: null,
          presence: 'OFFLINE',
          presenceManualAway: false,
          systemRole: 'USER',
          matrixUserId: null,
          deletedAt: new Date(),
        },
      }),
    ]);
  }

  /** Blob cleanup runs last and never fails the deletion; the row no longer points here. */
  private async removeProfileMedia(userId: string): Promise<void> {
    const keys = [
      `avatars/${userId}/avatar.webp`,
      ...[32, 48, 64, 96, 128, 512].map(
        (size) => `avatars/${userId}/avatar_${size}.webp`,
      ),
      `covers/${userId}/cover.webp`,
    ];
    await Promise.all(
      keys.map(async (key) => {
        try {
          if (await this.storage.exists(key)) await this.storage.delete(key);
        } catch (error) {
          this.logger.warn({
            event: 'account_deletion_media_cleanup_failed',
            key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  }
}
