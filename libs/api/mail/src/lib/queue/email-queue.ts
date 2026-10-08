import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { SendEmailOptions, EmailSendResult } from '../email.types.js';

export interface EmailJob {
  id: string;
  options: SendEmailOptions;
  attempts: number;
  maxRetries: number;
  status: 'queued' | 'scheduled' | 'processing' | 'sent' | 'failed';
  createdAt: Date;
  lastError?: string;
}

export type JobProcessor = (options: SendEmailOptions) => Promise<EmailSendResult>;

/** Failed jobs kept for inspection; older ones are dropped. */
const DEAD_LETTER_LIMIT = 100;

/**
 * In-process, fire-and-forget delivery queue.
 *
 * Jobs are sent one at a time in arrival order. A failed job is re-scheduled
 * with exponential backoff on a timer, so its wait never holds up the jobs
 * behind it. The queue is memory-only: pending jobs are lost on restart, so
 * mail that must not be lost should be sent with `EmailService.send` directly.
 * Callers should pass an `idempotencyKey` so a retried job cannot double-send.
 */
@Injectable()
export class EmailQueue implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueue.name);
  private readonly ready: EmailJob[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly deadLetterQueue: EmailJob[] = [];
  private isProcessing = false;
  private processor?: JobProcessor;

  setProcessor(processor: JobProcessor) {
    this.processor = processor;
    void this.drain();
  }

  /** Enqueue an email for asynchronous delivery; resolves with the job id. */
  async enqueue(
    options: SendEmailOptions,
    config: { maxRetries?: number; delayMs?: number } = {},
  ): Promise<string> {
    const job: EmailJob = {
      id: `job_${randomUUID()}`,
      options,
      attempts: 0,
      maxRetries: config.maxRetries ?? 3,
      status: 'queued',
      createdAt: new Date(),
    };
    this.logger.debug(`Enqueued email job ${job.id} (type=${options.type || 'CUSTOM'})`);
    this.schedule(job, config.delayMs ?? 0);
    return job.id;
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private schedule(job: EmailJob, delayMs: number): void {
    if (delayMs <= 0) {
      job.status = 'queued';
      this.ready.push(job);
      void this.drain();
      return;
    }
    job.status = 'scheduled';
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      job.status = 'queued';
      this.ready.push(job);
      void this.drain();
    }, delayMs);
    // A pending retry must not keep the process alive on shutdown.
    timer.unref?.();
    this.timers.add(timer);
  }

  private async drain(): Promise<void> {
    if (this.isProcessing || !this.processor) return;
    this.isProcessing = true;
    try {
      let job: EmailJob | undefined;
      while ((job = this.ready.shift())) {
        await this.run(job, this.processor);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async run(job: EmailJob, processor: JobProcessor): Promise<void> {
    job.status = 'processing';
    job.attempts++;
    try {
      const result = await processor(job.options);
      if (!result.delivered) throw new Error(result.error || 'Email dispatch failed.');
      job.status = 'sent';
    } catch (err: unknown) {
      job.lastError = err instanceof Error ? err.message : String(err);
      if (job.attempts <= job.maxRetries) {
        const backoffMs = Math.min(30_000, 500 * 2 ** (job.attempts - 1) + Math.random() * 200);
        this.logger.warn(
          `Job ${job.id} failed (attempt ${job.attempts}/${job.maxRetries + 1}): ${job.lastError}. Retrying in ${Math.round(backoffMs)}ms`,
        );
        this.schedule(job, backoffMs);
      } else {
        job.status = 'failed';
        this.deadLetterQueue.push(job);
        if (this.deadLetterQueue.length > DEAD_LETTER_LIMIT) this.deadLetterQueue.shift();
        this.logger.error(`Job ${job.id} permanently failed after ${job.attempts} attempts: ${job.lastError}`);
      }
    }
  }

  getQueueStatus() {
    return {
      pendingCount: this.ready.length + this.timers.size,
      deadLetterCount: this.deadLetterQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  getDeadLetterQueue(): ReadonlyArray<EmailJob> {
    return [...this.deadLetterQueue];
  }
}
