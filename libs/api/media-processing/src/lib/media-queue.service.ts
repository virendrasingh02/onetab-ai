import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheService } from '@org/api-cache';

export interface MediaJobPayload {
  jobId: string;
  workspaceId: string;
  uploadId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  variants: string[];
  createdAt: number;
}

export type MediaJobHandler = (job: MediaJobPayload) => Promise<void>;

@Injectable()
export class MediaQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaQueueService.name);
  private readonly queueName = 'media:processing';
  private isRunning = false;
  private workerTimer: NodeJS.Timeout | null = null;
  private handler: MediaJobHandler | null = null;

  constructor(private readonly cache: CacheService) {}

  onModuleInit(): void {
    this.startWorker();
  }

  onModuleDestroy(): void {
    this.stopWorker();
  }

  /**
   * Registers the processor function that processes queued media jobs.
   */
  registerHandler(handler: MediaJobHandler): void {
    this.handler = handler;
  }

  /**
   * Enqueues an image processing job into Redis or memory queue.
   */
  async enqueue(job: MediaJobPayload): Promise<void> {
    await this.cache.pushQueue(this.queueName, job);
    this.logger.debug(`Enqueued media job ${job.jobId} for upload ${job.uploadId}`);
  }

  /**
   * Starts the background queue worker.
   */
  private startWorker(): void {
    this.isRunning = true;
    const pollInterval = 1000; // 1s

    const loop = async () => {
      if (!this.isRunning) return;

      try {
        if (this.handler) {
          const job = await this.cache.popQueue<MediaJobPayload>(this.queueName);
          if (job) {
            this.logger.debug(`Processing queued media job ${job.jobId}`);
            try {
              await this.handler(job);
              this.logger.debug(`Completed media job ${job.jobId}`);
            } catch (err) {
              this.logger.error(`Media job ${job.jobId} failed:`, err);
            }
          }
        }
      } catch (err) {
        this.logger.warn('Media queue worker error:', err);
      } finally {
        if (this.isRunning) {
          this.workerTimer = setTimeout(loop, pollInterval);
        }
      }
    };

    this.workerTimer = setTimeout(loop, pollInterval);
  }

  private stopWorker(): void {
    this.isRunning = false;
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
  }
}
