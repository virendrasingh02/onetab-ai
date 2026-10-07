import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MatrixAdminService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type {
  MigrationScope,
} from '@org/types';
import { MigrationAiAdvisorService } from './migration-ai-advisor.service.js';
import { MigrationMappingService } from './migration-mapping.service.js';
import type {
  BatchResult,
  MigrationProvider,
  SourceChannel,
  SourceMessage,
  SourceUser,
} from './migration-provider.interface.js';
import { MigrationValidationService } from './migration-validation.service.js';

interface WorkerState {
  isPaused: boolean;
  isCancelled: boolean;
  throughputCount: number;
  lastThroughputTime: number;
  recordsPerSecond: number;
}

@Injectable()
export class MigrationWorkerService {
  private readonly logger = new Logger(MigrationWorkerService.name);
  private readonly activeWorkers = new Map<string, WorkerState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: MigrationMappingService,
    private readonly matrixAdmin: MatrixAdminService,
    private readonly validationService: MigrationValidationService,
    private readonly aiAdvisor: MigrationAiAdvisorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Pauses an actively running migration worker.
   */
  pause(migrationId: string) {
    const state = this.activeWorkers.get(migrationId);
    if (state) state.isPaused = true;
  }

  /**
   * Resumes a paused migration worker.
   */
  resume(migrationId: string) {
    const state = this.activeWorkers.get(migrationId);
    if (state) state.isPaused = false;
  }

  /**
   * Cancels a running migration worker.
   */
  cancel(migrationId: string) {
    const state = this.activeWorkers.get(migrationId);
    if (state) state.isCancelled = true;
  }

  /**
   * Main asynchronous entry point for executing a migration job.
   */
  async runMigration(
    migrationId: string,
    provider: MigrationProvider,
    authOrConfig: string | Record<string, unknown>,
  ): Promise<void> {
    const state: WorkerState = {
      isPaused: false,
      isCancelled: false,
      throughputCount: 0,
      lastThroughputTime: Date.now(),
      recordsPerSecond: 0,
    };
    this.activeWorkers.set(migrationId, state);

    try {
      this.logger.log(`Starting migration pipeline for ${migrationId}`);
      await this.prisma.migrationSession.update({
        where: { id: migrationId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          errorMessage: null,
        },
      });

      const session = await this.prisma.migrationSession.findUniqueOrThrow({
        where: { id: migrationId },
      });
      const scope = (session.scope || {}) as unknown as MigrationScope;
      const workspaceId = session.workspaceId;

      // STAGE 1: WORKSPACE METADATA
      await this.runStage(migrationId, 'WORKSPACE_METADATA', async () => {
        const meta = await provider.fetchWorkspaceMetadata(authOrConfig);
        await this.prisma.migrationSession.update({
          where: { id: migrationId },
          data: {
            sourceWorkspaceId: meta.id,
            sourceWorkspaceName: meta.name,
          },
        });
        await this.mappingService.recordMapping(
          migrationId,
          workspaceId,
          'WORKSPACE',
          meta.id,
          workspaceId,
          { name: meta.name, domain: meta.domain },
        );
      });

      if (this.shouldHalt(migrationId)) return;

      // STAGE 2 & 3: USERS & USER MAPPING
      const userMap = new Map<string, string>(); // sourceUserId -> destUserId
      await this.runStage(migrationId, 'USERS', async () => {
        let cursor: string | undefined;
        do {
          const userBatch: BatchResult<SourceUser> = await provider.fetchUsers(
            authOrConfig,
            cursor,
            100,
          );
          for (const u of userBatch.items) {
            if (this.shouldHalt(migrationId)) return;

            // Check if user already mapped for idempotency
            const existingMapping = await this.mappingService.getMapping(
              migrationId,
              'USER',
              u.id,
            );

            let destUserId = existingMapping?.destinationId;

            if (!destUserId) {
              destUserId = await this.resolveOrProvisionUser(workspaceId, u);
              await this.mappingService.recordMapping(
                migrationId,
                workspaceId,
                'USER',
                u.id,
                destUserId,
                { name: u.name, email: u.email, realName: u.realName },
              );
            }

            userMap.set(u.id, destUserId);
            this.recordProgressItem(migrationId, 'members', u.name);
          }
          cursor = userBatch.nextCursor;
        } while (cursor);
      });

      if (this.shouldHalt(migrationId)) return;

      // STAGE 4 & 5: CHANNELS & CHANNEL MEMBERSHIP
      const channelMap = new Map<string, { channelId: string; matrixRoomId?: string }>();
      await this.runStage(migrationId, 'CHANNELS', async () => {
        let cursor: string | undefined;
        do {
          const channelBatch = await provider.fetchChannels(
            authOrConfig,
            scope,
            cursor,
            50,
          );

          for (const c of channelBatch.items) {
            if (this.shouldHalt(migrationId)) return;

            // Check existing channel mapping for idempotency
            const existingMapping = await this.mappingService.getMapping(
              migrationId,
              'CHANNEL',
              c.id,
            );

            let destChannel: any = null;
            if (existingMapping?.destinationId) {
              destChannel = await this.prisma.channel.findUnique({
                where: { id: existingMapping.destinationId },
              });
            }

            if (!destChannel) {
              destChannel = await this.resolveOrProvisionChannel(
                workspaceId,
                session.createdById,
                c,
                existingMapping?.resolution,
                (existingMapping?.metadata as any)?.renameTo,
              );
              await this.mappingService.recordMapping(
                migrationId,
                workspaceId,
                'CHANNEL',
                c.id,
                destChannel.id,
                { name: destChannel.name, slug: destChannel.slug },
              );
            }

            channelMap.set(c.id, {
              channelId: destChannel.id,
              matrixRoomId: destChannel.matrixRoomId ?? undefined,
            });

            // Sync channel memberships
            await this.syncChannelMembers(
              provider,
              authOrConfig,
              c.id,
              destChannel.id,
              userMap,
            );

            this.recordProgressItem(migrationId, 'channels', `#${destChannel.name}`);
          }
          cursor = channelBatch.nextCursor;
        } while (cursor);
      });

      if (this.shouldHalt(migrationId)) return;

      // STAGE 6, 7, 8, 9, 10: MESSAGES, THREADS, REACTIONS, MENTIONS, FILES
      if (!scope.structureOnly) {
        await this.runStage(migrationId, 'MESSAGES', async () => {
          for (const [sourceChannelId, targetInfo] of channelMap.entries()) {
            if (this.shouldHalt(migrationId)) return;

            await this.migrateChannelHistory(
              migrationId,
              provider,
              authOrConfig,
              sourceChannelId,
              targetInfo.channelId,
              targetInfo.matrixRoomId,
              userMap,
              scope,
            );
          }
        });
      }

      if (this.shouldHalt(migrationId)) return;

      // STAGE 12: SEARCH INDEXING
      await this.runStage(migrationId, 'SEARCH_INDEXING', async () => {
        // Postgres tsvector GIN indexes update automatically on row upserts
        this.logger.log(`Postgres full-text search indexes synced for workspace ${workspaceId}`);
      });

      // STAGE 13: VALIDATION
      await this.runStage(migrationId, 'VALIDATION', async () => {
        await this.validationService.validateMigration(migrationId);
      });

      // STAGE 14: AI ADVISOR & ADOPTION
      await this.runStage(migrationId, 'FINALIZATION', async () => {
        await this.aiAdvisor.generateAdoptionRecommendations(workspaceId, migrationId);
      });

      // MARK AS COMPLETED
      await this.prisma.migrationSession.update({
        where: { id: migrationId },
        data: {
          status: 'COMPLETED',
          currentStage: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await this.logAudit(workspaceId, session.createdById, 'migration.completed', migrationId, {
        sourceWorkspace: session.sourceWorkspaceName,
      });

      this.logger.log(`Migration ${migrationId} finished successfully.`);
    } catch (err: any) {
      this.logger.error(`Migration ${migrationId} failed: ${err.message}`, err.stack);
      await this.prisma.migrationSession.update({
        where: { id: migrationId },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
    } finally {
      this.activeWorkers.delete(migrationId);
    }
  }

  private shouldHalt(migrationId: string): boolean {
    const state = this.activeWorkers.get(migrationId);
    if (!state) return true;
    if (state.isCancelled) {
      this.prisma.migrationSession
        .update({ where: { id: migrationId }, data: { status: 'CANCELLED' } })
        .catch(() => null);
      return true;
    }
    if (state.isPaused) {
      this.prisma.migrationSession
        .update({ where: { id: migrationId }, data: { status: 'PAUSED', pausedAt: new Date() } })
        .catch(() => null);
      return true;
    }
    return false;
  }

  private async runStage(
    migrationId: string,
    stage: any,
    fn: () => Promise<void>,
  ): Promise<void> {
    await this.prisma.migrationSession.update({
      where: { id: migrationId },
      data: { currentStage: stage },
    });

    const step = await this.prisma.migrationStep.create({
      data: {
        migrationId,
        stage,
        name: stage,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      await fn();
      await this.prisma.migrationStep.update({
        where: { id: step.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } catch (err: any) {
      await this.prisma.migrationStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          errorDetails: { error: err.message },
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /**
   * Deterministically matches or provisions a destination user preserving identity.
   */
  private async resolveOrProvisionUser(
    workspaceId: string,
    sourceUser: SourceUser,
  ): Promise<string> {
    // 1. If user has email, check existing user
    if (sourceUser.email) {
      const email = sourceUser.email.toLowerCase();
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Ensure membership in destination workspace
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: existingUser.id,
            },
          },
          create: {
            workspaceId,
            userId: existingUser.id,
            role: sourceUser.isAdmin ? 'ADMIN' : 'MEMBER',
          },
          update: {},
        });
        return existingUser.id;
      }
    }

    // 2. Create placeholder or invited user with original author identity preserved
    const randomHash = Math.random().toString(36).substring(2, 9);
    const placeholderEmail = sourceUser.email || `slack_${sourceUser.id}_${randomHash}@imported.local`;
    const name = sourceUser.displayName || sourceUser.realName || sourceUser.name;

    const newUser = await this.prisma.user.create({
      data: {
        email: placeholderEmail,
        name,
        displayName: sourceUser.displayName || sourceUser.realName,
        avatarUrl: sourceUser.avatarUrl,
        passwordHash: '$2b$10$placeholder_migration_hash',
        bio: `Imported from Slack (${sourceUser.id})`,
        timezone: sourceUser.timezone || 'UTC',
      },
    });

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: newUser.id,
        role: sourceUser.isAdmin ? 'ADMIN' : 'MEMBER',
      },
    });

    return newUser.id;
  }

  /**
   * Deterministically resolves or provisions a channel.
   */
  private async resolveOrProvisionChannel(
    workspaceId: string,
    creatorId: string,
    sourceChannel: SourceChannel,
    resolutionStrategy?: string,
    customRename?: string,
  ) {
    const rawName = customRename || sourceChannel.name.replace(/^#/, '');
    const cleanName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const slug = cleanName;

    // Check existing
    const existing = await this.prisma.channel.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });

    if (existing && (resolutionStrategy === 'USE_EXISTING' || resolutionStrategy === 'MERGE')) {
      return existing;
    }

    const finalSlug = existing ? `${slug}-slack` : slug;
    const finalName = existing ? `${rawName} (Slack)` : rawName;

    const created = await this.prisma.channel.create({
      data: {
        workspaceId,
        createdById: creatorId,
        name: finalName,
        slug: finalSlug,
        topic: sourceChannel.topic || 'Migrated from Slack',
        description: sourceChannel.purpose || 'Imported Slack Channel',
        visibility: sourceChannel.isPrivate ? 'PRIVATE' : 'PUBLIC',
        isArchived: sourceChannel.isArchived || resolutionStrategy === 'ARCHIVE',
        archivedAt: sourceChannel.isArchived ? new Date() : null,
      },
    });

    return created;
  }

  /**
   * Syncs channel members.
   */
  private async syncChannelMembers(
    provider: MigrationProvider,
    authOrConfig: string | Record<string, unknown>,
    sourceChannelId: string,
    destChannelId: string,
    userMap: Map<string, string>,
  ) {
    try {
      const sourceMemberIds = await provider.fetchChannelMembers(authOrConfig, sourceChannelId);
      for (const smId of sourceMemberIds) {
        const destUserId = userMap.get(smId);
        if (destUserId) {
          await this.prisma.channelMember.upsert({
            where: {
              channelId_userId: {
                channelId: destChannelId,
                userId: destUserId,
              },
            },
            create: {
              channelId: destChannelId,
              userId: destUserId,
            },
            update: {},
          });
        }
      }
    } catch (e: any) {
      this.logger.warn(`Could not sync channel members for ${sourceChannelId}: ${e.message}`);
    }
  }

  /**
   * Migrates channel messages, threads, reactions, and files.
   * HISTORICAL MESSAGES DO NOT TRIGGER NOTIFICATIONS!
   */
  private async migrateChannelHistory(
    migrationId: string,
    provider: MigrationProvider,
    authOrConfig: string | Record<string, unknown>,
    sourceChannelId: string,
    destChannelId: string,
    matrixRoomId: string | undefined,
    userMap: Map<string, string>,
    scope: MigrationScope,
  ) {
    let cursor: string | undefined;
    do {
      const batch: BatchResult<SourceMessage> = await provider.fetchMessages(
        authOrConfig,
        sourceChannelId,
        {
          cursor,
          limit: 100,
          oldest: scope.dateRange?.from,
          latest: scope.dateRange?.to,
        },
      );

      for (const msg of batch.items) {
        if (this.shouldHalt(migrationId)) return;

        // Idempotency check
        const existingMapping = await this.mappingService.getMapping(
          migrationId,
          'MESSAGE',
          msg.id,
        );
        if (existingMapping) continue;

        const destUserId = userMap.get(msg.userId) || 'system';
        const normalizedText = this.normalizeSlackFormatting(msg.text, userMap);

        // Post into the channel's Matrix room as the mapped user. The mapping
        // keeps the real event id when it got there; otherwise a placeholder,
        // marked undelivered so it isn't mistaken for a migrated message.
        const eventId = matrixRoomId
          ? await this.sendHistoricMessage(matrixRoomId, destUserId, {
              msgtype: 'm.text',
              body: normalizedText,
              'org.onetab.historical_migration': true, // Flags suppression of notifications
              origin_server_ts: Math.round(Number(msg.timestamp) * 1000),
            })
          : null;
        const destMessageId = eventId ?? `hist_${msg.id}`;

        await this.mappingService.recordMapping(
          migrationId,
          destChannelId,
          'MESSAGE',
          msg.id,
          destMessageId,
          { timestamp: msg.timestamp, delivered: eventId !== null },
        );

        // Migrate thread replies if this is a thread root with replies
        if (msg.replyCount && msg.replyCount > 0) {
          await this.migrateThreadReplies(
            migrationId,
            provider,
            authOrConfig,
            sourceChannelId,
            destChannelId,
            matrixRoomId,
            msg.timestamp,
            destMessageId,
            userMap,
          );
        }

        // Migrate reactions
        if (msg.reactions && msg.reactions.length > 0) {
          for (const rx of msg.reactions) {
            await this.mappingService.recordMapping(
              migrationId,
              destChannelId,
              'REACTION',
              `${msg.id}_${rx.name}`,
              rx.name,
              { count: rx.count },
            );
            this.recordProgressItem(migrationId, 'reactions');
          }
        }

        // Migrate files if included
        if (scope.includeFiles && msg.files && msg.files.length > 0) {
          for (const f of msg.files) {
            await this.mappingService.recordMapping(
              migrationId,
              destChannelId,
              'FILE',
              f.id,
              f.permalink || f.urlPrivate || f.id,
              { name: f.name, size: f.size, mimeType: f.mimeType },
            );
            this.recordProgressItem(migrationId, 'files', f.name);
          }
        }

        this.recordProgressItem(migrationId, 'messages');
      }

      cursor = batch.nextCursor;
    } while (cursor);
  }

  private async migrateThreadReplies(
    migrationId: string,
    provider: MigrationProvider,
    authOrConfig: string | Record<string, unknown>,
    sourceChannelId: string,
    destChannelId: string,
    matrixRoomId: string | undefined,
    threadTs: string,
    rootDestMessageId: string,
    userMap: Map<string, string>,
  ) {
    try {
      const replies = await provider.fetchThreadReplies(
        authOrConfig,
        sourceChannelId,
        threadTs,
      );

      for (const reply of replies) {
        const existingMapping = await this.mappingService.getMapping(
          migrationId,
          'THREAD',
          reply.id,
        );
        if (existingMapping) continue;

        const destUserId = userMap.get(reply.userId) || 'system';
        const normalizedText = this.normalizeSlackFormatting(reply.text, userMap);

        // Only a real root event can carry a thread; a placeholder root means
        // the root never reached Matrix, so the reply posts unthreaded.
        const rootIsEvent = rootDestMessageId.startsWith('$');
        const eventId = matrixRoomId
          ? await this.sendHistoricMessage(matrixRoomId, destUserId, {
              msgtype: 'm.text',
              body: normalizedText,
              ...(rootIsEvent ? { 'm.relates_to': { rel_type: 'm.thread', event_id: rootDestMessageId } } : {}),
              'org.onetab.historical_migration': true,
              origin_server_ts: Math.round(Number(reply.timestamp) * 1000),
            })
          : null;

        await this.mappingService.recordMapping(
          migrationId,
          destChannelId,
          'THREAD',
          reply.id,
          eventId ?? `thread_${reply.id}`,
          { threadTs, parentId: rootDestMessageId, delivered: eventId !== null },
        );

        this.recordProgressItem(migrationId, 'threads');
      }
    } catch (e: any) {
      this.logger.warn(`Failed to migrate replies for thread ${threadTs}: ${e.message}`);
    }
  }

  /**
   * Normalizes Slack mrkdwn into standard Markdown and translates user/channel mentions.
   */
  private normalizeSlackFormatting(text: string, userMap: Map<string, string>): string {
    if (!text) return '';

    let out = text;
    // Replace user mentions <@U12345> -> @User
    out = out.replace(/<@([A-Z0-9]+)>/g, (_match, slackUserId) => {
      const destId = userMap.get(slackUserId);
      return destId ? `@User` : `@${slackUserId}`;
    });

    // Replace channel mentions <#C12345|general> -> #general
    out = out.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2');
    out = out.replace(/<#([A-Z0-9]+)>/g, '#channel');

    // Replace URL links <https://example.com|Example> -> [Example](https://example.com)
    out = out.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');
    out = out.replace(/<(https?:\/\/[^>]+)>/g, '$1');

    return out;
  }

  /**
   * Sends one historical message into a Matrix room as the mapped platform
   * user. Returns the event id, or null (logged) when it could not be sent —
   * e.g. an unmapped author, or a user with no Matrix identity yet.
   */
  private async sendHistoricMessage(
    matrixRoomId: string,
    destUserId: string,
    content: Record<string, unknown>,
  ): Promise<string | null> {
    if (destUserId === 'system') return null;
    try {
      return await this.matrixAdmin.sendEventAs(
        matrixRoomId,
        this.matrixAdmin.matrixUserIdFor(destUserId),
        'm.room.message',
        content,
      );
    } catch (e: any) {
      this.logger.warn(`Could not post a migrated message to ${matrixRoomId}: ${e?.message ?? e}`);
      return null;
    }
  }

  private recordProgressItem(
    migrationId: string,
    category: 'members' | 'channels' | 'messages' | 'threads' | 'reactions' | 'files',
    itemName?: string,
  ) {
    const state = this.activeWorkers.get(migrationId);
    if (!state) return;

    state.throughputCount++;
    const now = Date.now();
    const elapsed = (now - state.lastThroughputTime) / 1000;
    if (elapsed >= 1.0) {
      state.recordsPerSecond = Math.round(state.throughputCount / elapsed);
      state.throughputCount = 0;
      state.lastThroughputTime = now;
    }

    // Emit live event for connected clients
    this.eventEmitter.emit('migration.progress', {
      migrationId,
      category,
      itemName,
      recordsPerSecond: state.recordsPerSecond,
    });
  }

  private async logAudit(
    workspaceId: string,
    actorId: string,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.workspaceAuditLog.create({
        data: {
          workspaceId,
          actorId,
          action,
          targetType: 'MIGRATION',
          targetId,
          metadata: metadata ? (metadata as any) : undefined,
        },
      });
    } catch {
      // audit log failure should never break migration
    }
  }
}
