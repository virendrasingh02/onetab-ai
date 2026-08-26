import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Public } from '@org/api-common';
import type { Request } from 'express';
import { WebhookService } from './core/webhook.service.js';

@Controller({ version: '1' })
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Public()
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = typeof req.body === 'string' ? req.body : undefined;
    return this.webhookService.processWebhook(provider, body, headers, rawBody);
  }

  @Public()
  @Post('integrations/webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async handleIntegrationWebhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = typeof req.body === 'string' ? req.body : undefined;
    return this.webhookService.processWebhook(provider, body, headers, rawBody);
  }
}
