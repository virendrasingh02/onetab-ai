import { Global, Module } from '@nestjs/common';
import { EmailService, MailService } from './email.service.js';
import { ResendWebhookController } from './webhooks/resend-webhook.controller.js';
import { ResendWebhookService } from './webhooks/resend-webhook.service.js';

/**
 * Global module providing transactional email capabilities across all platform features.
 * Supports Resend HTTP API (`MAIL_TRANSPORT=http`) and logging (`MAIL_TRANSPORT=log`).
 * Exports both `EmailService` (primary) and `MailService` (legacy alias).
 */
@Global()
@Module({
  controllers: [ResendWebhookController],
  providers: [
    EmailService,
    {
      provide: MailService,
      useExisting: EmailService,
    },
    ResendWebhookService,
  ],
  exports: [EmailService, MailService, ResendWebhookService],
})
export class MailModule {}
