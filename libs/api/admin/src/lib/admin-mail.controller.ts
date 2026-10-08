import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles } from '@org/api-common';
import { EmailService } from '@org/api-mail';
import {
  SystemRole,
  type EmailTemplateCategory,
  type EmailTemplateDefinition,
  type EmailTemplateStatus,
} from '@org/types';

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Fields an operator may change on a template; everything else is server-owned. */
type TemplateUpdateBody = Pick<
  Partial<EmailTemplateDefinition>,
  'name' | 'description' | 'subject' | 'previewText' | 'htmlBody' | 'textBody' | 'status'
> & { workspaceId?: string | null };

/**
 * The operator console's transactional-email surface: template catalog,
 * overrides, previews, test sends, and provider health.
 *
 * Lives here rather than in `@org/api-mail` because it needs the operator gate
 * from `@org/api-auth`, which itself depends on the mail library. Every route
 * can rewrite platform-wide email content or send mail, so the whole class is
 * SUPERADMIN-only.
 */
@Controller({ path: 'admin/mail', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN)
export class AdminMailController {
  constructor(private readonly email: EmailService) {}

  @Get('templates')
  listTemplates(
    @Query('category') category?: EmailTemplateCategory | 'all',
    @Query('status') status?: EmailTemplateStatus | 'all',
    @Query('search') search?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<EmailTemplateDefinition[]> {
    return this.email.templateRegistry.listTemplates({ category, status, search, workspaceId });
  }

  @Get('templates/:key')
  getTemplate(
    @Param('key') key: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<EmailTemplateDefinition> {
    return this.requireTemplate(key, workspaceId);
  }

  @Put('templates/:key')
  async updateTemplate(
    @Param('key') key: string,
    @Body() body: TemplateUpdateBody,
    @CurrentUser('id') actorId: string,
  ): Promise<EmailTemplateDefinition> {
    // Only existing keys may be customised: an unknown key would create a
    // template nothing ever sends.
    await this.requireTemplate(key, body.workspaceId);
    return this.email.templateRegistry.saveTemplate(
      {
        templateKey: key,
        workspaceId: body.workspaceId ?? null,
        name: body.name,
        description: body.description,
        subject: body.subject,
        previewText: body.previewText,
        htmlBody: body.htmlBody,
        textBody: body.textBody,
        status: body.status,
      },
      actorId,
    );
  }

  @Post('templates/:key/preview')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(
    @Param('key') key: string,
    @Body()
    body: {
      data?: Record<string, unknown>;
      workspaceId?: string;
      customHtml?: string;
      customSubject?: string;
    },
  ) {
    const template = await this.requireTemplate(key, body.workspaceId);
    return this.email.templateRenderer.renderPreview(
      {
        ...template,
        subject: body.customSubject || template.subject,
        htmlBody: body.customHtml || template.htmlBody,
      },
      body.data,
    );
  }

  @Post('templates/:key/test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(
    @Param('key') key: string,
    @Body() body: { recipient: string; data?: Record<string, unknown>; workspaceId?: string },
    @CurrentUser('id') actorId: string,
  ) {
    const recipient = body.recipient?.trim();
    if (!recipient || !EMAIL_RE.test(recipient)) {
      throw new BadRequestException('A valid recipient email address is required.');
    }
    const template = await this.requireTemplate(key, body.workspaceId);

    return this.email.sendTransactionalEmail({
      templateKey: template.templateKey,
      recipient,
      data: body.data || template.variablesSchema?.samplePayload || {},
      workspaceId: body.workspaceId,
      metadata: { isTestSend: true, requestedBy: actorId },
      forceSend: true,
    });
  }

  @Post('templates/:key/reset')
  @HttpCode(HttpStatus.OK)
  async resetTemplate(
    @Param('key') key: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<EmailTemplateDefinition | { message: string }> {
    const reset = await this.email.templateRegistry.resetToDefault(key, workspaceId);
    return reset ?? { message: 'Template override removed.' };
  }

  @Get('providers')
  async listProviders() {
    const manager = this.email.providerManager;
    return {
      primary: manager.primaryName,
      fallback: manager.fallbackNames,
      providers: await manager.listProviders(),
      queue: this.email.queue.getQueueStatus(),
    };
  }

  @Post('providers/:name/verify')
  @HttpCode(HttpStatus.OK)
  async verifyProvider(@Param('name') name: string) {
    const provider = this.email.providerManager.getProvider(name);
    if (!provider) throw new NotFoundException(`Unknown email provider "${name}".`);
    const verified = await provider.verify();
    return {
      name: provider.name,
      verified,
      message: verified
        ? 'Provider is configured and reachable.'
        : 'Provider is not configured or could not be reached.',
    };
  }

  @Get('events')
  listEventMappings() {
    return this.email.events.listMappings();
  }

  private async requireTemplate(key: string, workspaceId?: string | null) {
    const template = await this.email.templateRegistry.getTemplate(key, workspaceId);
    if (!template) throw new NotFoundException(`Template ${key} not found.`);
    return template;
  }
}
