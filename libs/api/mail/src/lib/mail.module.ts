import { Global, Module } from '@nestjs/common';
import { EmailService, MailService } from './email.service.js';
import { ResendWebhookController } from './webhooks/resend-webhook.controller.js';
import { ResendWebhookService } from './webhooks/resend-webhook.service.js';
import { TemplateRegistry } from './templates/registry.js';
import { TemplateRenderer } from './templates/template-renderer.js';
import { EmailProviderManager } from './providers/provider-manager.js';
import { EmailQueue } from './queue/email-queue.js';
import { OtpManager } from './otp/otp.manager.js';
import { NotificationPreferenceManager } from './preferences/notification-preference.manager.js';
import { EmailEventRegistry } from './events/email-event.registry.js';

/**
 * Global module providing transactional email capabilities across all platform features.
 * Exports both `EmailService` (primary) and `MailService` (legacy alias) along with sub-services.
 */
@Global()
@Module({
  controllers: [ResendWebhookController],
  providers: [
    TemplateRegistry,
    TemplateRenderer,
    EmailProviderManager,
    EmailQueue,
    OtpManager,
    NotificationPreferenceManager,
    EmailEventRegistry,
    EmailService,
    {
      provide: MailService,
      useExisting: EmailService,
    },
    ResendWebhookService,
  ],
  exports: [
    EmailService,
    MailService,
    TemplateRegistry,
    TemplateRenderer,
    EmailProviderManager,
    EmailQueue,
    OtpManager,
    NotificationPreferenceManager,
    EmailEventRegistry,
    ResendWebhookService,
  ],
})
export class MailModule {}
