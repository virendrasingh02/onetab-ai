import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { IntegrationLoggerService } from './integration-logger.service.js';
import type { ProviderAdapter, ResolvedCredential } from './provider-adapter.interface.js';

@Injectable()
export class IntegrationSyncService {
  private readonly logger = new Logger(IntegrationSyncService.name);
  private isProcessingQueue = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: IntegrationLoggerService,
  ) {}

  /**
   * Enqueues a synchronization job and triggers background execution.
   */
  async enqueueSyncJob(params: {
    integrationId: string;
    jobType?: 'INITIAL_SYNC' | 'INCREMENTAL_SYNC' | 'ATTACHMENT_SYNC';
    cursor?: string;
  }) {
    const job = await this.prisma.integrationSyncJob.create({
      data: {
        integrationId: params.integrationId,
        jobType: params.jobType ?? 'INCREMENTAL_SYNC',
        status: 'PENDING',
        cursor: params.cursor,
      },
    });

    this.logger.log(
      `Enqueued sync job ${job.id} for integration ${params.integrationId} (${job.jobType})`,
    );

    // Fire background execution without blocking HTTP caller
    setImmediate(() => {
      this.processPendingJobs().catch((err) =>
        this.logger.error(`Error in background sync worker: ${err instanceof Error ? err.message : String(err)}`),
      );
    });

    return job;
  }

  /**
   * Executes sync for a specific job directly with an adapter and credentials.
   */
  async executeJob(
    jobId: string,
    adapter: ProviderAdapter,
    credential: ResolvedCredential,
  ) {
    const startTime = Date.now();
    await this.prisma.integrationSyncJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const job = await this.prisma.integrationSyncJob.findUnique({
        where: { id: jobId },
      });

      const syncResult = await adapter.sync(credential, job?.cursor ?? undefined);

      await this.prisma.integrationSyncJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          itemsProcessed: syncResult.itemsProcessed,
          totalItems: syncResult.totalItems ?? syncResult.itemsProcessed,
          cursor: syncResult.newCursor,
          completedAt: new Date(),
        },
      });

      await this.prisma.externalIntegration.update({
        where: { id: credential.id },
        data: {
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await this.auditLogger.logAudit({
        integrationId: credential.id,
        workspaceId: credential.workspaceId,
        userId: credential.userId,
        action: 'SYNC_COMPLETED',
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
        details: { jobId, syncResult },
      });

      return syncResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sync job ${jobId} failed: ${errorMsg}`);

      const currentJob = await this.prisma.integrationSyncJob.findUnique({
        where: { id: jobId },
      });

      const retryCount = (currentJob?.retryCount ?? 0) + 1;
      const maxRetries = currentJob?.maxRetries ?? 3;
      const canRetry = retryCount < maxRetries;

      await this.prisma.integrationSyncJob.update({
        where: { id: jobId },
        data: {
          status: canRetry ? 'PENDING' : 'FAILED',
          retryCount,
          errorMessage: errorMsg,
          completedAt: canRetry ? null : new Date(),
        },
      });

      await this.prisma.externalIntegration.update({
        where: { id: credential.id },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: errorMsg,
        },
      });

      await this.auditLogger.logAudit({
        integrationId: credential.id,
        workspaceId: credential.workspaceId,
        userId: credential.userId,
        action: 'SYNC_FAILED',
        status: 'FAILURE',
        durationMs: Date.now() - startTime,
        details: { jobId, error: errorMsg, retryCount, maxRetries },
      });

      throw err;
    }
  }

  /**
   * Processes pending background jobs in the database queue.
   */
  async processPendingJobs() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      const pendingJobs = await this.prisma.integrationSyncJob.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });

      for (const job of pendingJobs) {
        // Exponential backoff wait if it has retried before
        if (job.retryCount > 0) {
          const delayMs = Math.min(1000 * 2 ** job.retryCount, 30000);
          const elapsed = Date.now() - job.updatedAt.getTime();
          if (elapsed < delayMs) {
            continue; // Not yet time to retry this job
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Retrieves recent sync jobs for an integration.
   */
  async getSyncJobs(integrationId: string, limit = 20) {
    return this.prisma.integrationSyncJob.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
