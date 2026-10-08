import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '@org/api-common';
import type { Request } from 'express';
import { ResendWebhookService, type ResendWebhookPayload } from './resend-webhook.service.js';

@Controller({ path: 'webhooks/resend', version: '1' })
export class ResendWebhookController {
  constructor(private readonly webhookService: ResendWebhookService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Body() body: ResendWebhookPayload,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    // main.ts keeps the raw bytes for webhook routes; the stringify fallback
    // only serves callers (tests) that bypass that body parser.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? JSON.stringify(body);

    const isValid = this.webhookService.verifySignature(rawBody, headers);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Resend webhook signature.');
    }

    if (!body || !body.type) {
      throw new BadRequestException('Malformed webhook payload.');
    }

    await this.webhookService.handleEvent(body);
    return { received: true };
  }
}
