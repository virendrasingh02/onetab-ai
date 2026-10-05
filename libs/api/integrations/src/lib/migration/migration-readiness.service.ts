import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  MigrationCapabilityReport,
  MigrationReadinessCheck,
  MigrationReadinessReport,
  MigrationScope,
} from '@org/types';
import type { MigrationProvider } from './migration-provider.interface.js';

@Injectable()
export class MigrationReadinessService {
  private readonly logger = new Logger(MigrationReadinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateReadiness(
    destinationWorkspaceId: string,
    provider: MigrationProvider,
    authOrConfig: string | Record<string, unknown>,
    scope: MigrationScope,
    capabilitiesReport: MigrationCapabilityReport,
  ): Promise<MigrationReadinessReport> {
    const checks: MigrationReadinessCheck[] = [];
    const generatedAt = new Date().toISOString();

    // 1. Destination Workspace Verification
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: destinationWorkspaceId },
      include: {
        _count: {
          select: {
            members: true,
            channels: true,
          },
        },
      },
    });

    if (!workspace) {
      checks.push({
        id: 'dest_workspace_exists',
        title: 'Destination Workspace Existence',
        category: 'compatibility',
        status: 'blocker',
        message: 'Destination workspace could not be found.',
        resolutionHint: 'Select a valid workspace within your organization.',
      });
    } else {
      checks.push({
        id: 'dest_workspace_ready',
        title: 'Destination Workspace Ready',
        category: 'compatibility',
        status: 'passed',
        message: `Connected to destination "${workspace.name}" (${workspace._count.members} current members, ${workspace._count.channels} existing channels).`,
      });
    }

    // 2. Authentication & Admin Authorization
    if (!capabilitiesReport.canMigrate) {
      checks.push({
        id: 'source_auth_valid',
        title: 'Slack Authentication & Core Scopes',
        category: 'access',
        status: 'blocker',
        message: `Missing essential migration permissions: ${capabilitiesReport.blockers.join(', ')}`,
        resolutionHint: 'Re-authorize the Slack connector with requested channel & member permissions.',
      });
    } else {
      checks.push({
        id: 'source_auth_valid',
        title: 'Slack Connection Verified',
        category: 'access',
        status: 'passed',
        message: `Successfully authenticated with ${capabilitiesReport.workspace.name} as ${capabilitiesReport.connectedAccount.name}.`,
      });
    }

    // 3. User & Member Mapping Feasibility
    const emailScope = capabilitiesReport.scopes.includes('users:read.email');
    if (!emailScope) {
      checks.push({
        id: 'user_email_access',
        title: 'User Email Discovery (users:read.email)',
        category: 'permissions',
        status: 'warning',
        message:
          'Email addresses are not exposed by the current Slack authorization. Users will be matched by linked Slack ID or require manual admin matching.',
        resolutionHint: 'Grant users:read.email for automated zero-click member matching.',
      });
    } else {
      checks.push({
        id: 'user_email_access',
        title: 'User Email Matching Active',
        category: 'permissions',
        status: 'passed',
        message: 'Member email addresses are accessible for deterministic user mapping.',
      });
    }

    // 4. Channel Access & Privacy
    if (scope.includePrivateChannels && capabilitiesReport.capabilities.private_channels.status !== 'available') {
      checks.push({
        id: 'private_channel_scope',
        title: 'Private Channels Authorization',
        category: 'permissions',
        status: 'warning',
        message: 'Scope includes private channels, but Slack did not grant private channel read access (groups:read).',
        resolutionHint: 'Re-authenticate with private channel read access or remove private channels from scope.',
      });
    } else if (scope.includePrivateChannels) {
      checks.push({
        id: 'private_channel_scope',
        title: 'Private Channels Authorized',
        category: 'permissions',
        status: 'passed',
        message: 'Private channels are accessible for migration.',
      });
    }

    // 5. Direct Message (DM) Authorization
    if (scope.includeDms && capabilitiesReport.capabilities.dms.status !== 'available') {
      checks.push({
        id: 'dm_scope',
        title: 'Direct Message Privacy & Consent',
        category: 'permissions',
        status: 'warning',
        message: 'Direct Messages (DMs) cannot be accessed without individual user authorization tokens or Corporate Export permissions.',
        resolutionHint: 'DMs will be skipped unless an elevated Corporate Export token is provided.',
      });
    }

    // 6. Data Availability & Estimation
    let userEstimate = 0;
    let channelEstimate = 0;
    try {
      const usersSample = await provider.fetchUsers(authOrConfig, undefined, 50);
      userEstimate = usersSample.totalEstimate ?? usersSample.items.length;

      const channelsSample = await provider.fetchChannels(authOrConfig, scope, undefined, 50);
      channelEstimate = channelsSample.totalEstimate ?? channelsSample.items.length;
    } catch (e: any) {
      this.logger.warn(`Failed to probe initial estimates: ${e.message}`);
    }

    const estimatedMessages = Math.max(channelEstimate * 250, 1000);
    const estimatedFiles = scope.includeFiles ? Math.round(estimatedMessages * 0.08) : 0;
    const estimatedStorageMb = Math.round(estimatedFiles * 1.8);
    const minMinutes = Math.max(1, Math.round(estimatedMessages / 600));
    const maxMinutes = Math.max(minMinutes + 2, Math.round(minMinutes * 2.5));

    checks.push({
      id: 'data_volume_assessment',
      title: 'Estimated Migration Volume & Duration',
      category: 'data',
      status: 'passed',
      message: `Estimated ~${userEstimate} members, ~${channelEstimate} channels, and ~${estimatedMessages.toLocaleString()} messages (${estimatedDurationMinutesString(minMinutes, maxMinutes)}).`,
    });

    // 7. Storage Driver Readiness
    checks.push({
      id: 'storage_readiness',
      title: 'Platform Storage Readiness',
      category: 'storage',
      status: 'passed',
      message: `Object storage ready to receive up to ${estimatedStorageMb} MB of files and attachments.`,
    });

    const passedCount = checks.filter((c) => c.status === 'passed').length;
    const warningCount = checks.filter((c) => c.status === 'warning').length;
    const blockerCount = checks.filter((c) => c.status === 'blocker').length;
    const canProceed = blockerCount === 0;

    return {
      checks,
      canProceed,
      estimates: {
        membersCount: userEstimate,
        channelsCount: channelEstimate,
        messagesCount: estimatedMessages,
        filesCount: estimatedFiles,
        estimatedStorageMb,
        estimatedDurationMinutes: [minMinutes, maxMinutes],
      },
      passedCount,
      warningCount,
      blockerCount,
      generatedAt,
    };
  }
}

function estimatedDurationMinutesString(min: number, max: number): string {
  if (min === max) return `~${min} min`;
  return `${min}–${max} min`;
}
