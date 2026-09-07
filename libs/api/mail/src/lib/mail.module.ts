import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/**
 * Global so any feature module can inject `MailService` without adding a local
 * import — email is a cross-cutting side-effect (invitations, password reset,
 * digests), not a feature dependency.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
