import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '@org/api-common';
import type { Request } from 'express';
import { BillingWebhookService, RetryWebhookLater } from './billing-webhook.service.js';
import { InvalidWebhookSignatureError, PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

/**
 * Payment-provider webhook endpoint. Public by necessity (the provider has no
 * session) — authenticity comes from the provider signature over the raw body,
 * which `main.ts` preserves for any `/webhooks/` route.
 */
@Controller({ path: 'webhooks/billing', version: '1' })
export class BillingWebhookController {
  constructor(
    private readonly webhooks: BillingWebhookService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true; duplicate: boolean }> {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('Billing webhooks are not configured.');
    }
    if (!req.rawBody) {
      // Without the exact bytes a signature cannot be verified; refuse rather than guess.
      throw new UnauthorizedException('Missing raw request body.');
    }
    try {
      const result = await this.webhooks.handle(req.rawBody, signature);
      return { received: true, duplicate: result.duplicate };
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException('Invalid webhook signature.');
      }
      if (err instanceof RetryWebhookLater) {
        throw new ServiceUnavailableException('Not ready yet; please redeliver.');
      }
      throw err;
    }
  }
}
