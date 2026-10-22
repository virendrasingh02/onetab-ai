import {
  Body,
  Controller,
  Get,
  GoneException,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Public } from '@org/api-common';
import type { Request } from 'express';
import { ConnectorWebhookService } from './connectors/connector-webhook.service.js';

@Controller({ version: '1' })
export class WebhooksController {
  constructor(
    private readonly connectorWebhooks: ConnectorWebhookService,
  ) {}

  /** A connected app's push (verified against that connection's own secret). */
  @Public()
  @Post('webhooks/connectors/:integrationId')
  @HttpCode(HttpStatus.OK)
  async handleConnectorWebhook(
    @Param('integrationId') integrationId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    return this.connectorWebhooks.receive(integrationId, raw?.toString('utf8'), body, headers);
  }

  /** The app's subscription handshake (e.g. WhatsApp's `hub.challenge`). */
  @Public()
  @Get('webhooks/connectors/:integrationId')
  @Header('Content-Type', 'text/plain')
  async connectorWebhookChallenge(@Param('integrationId') integrationId: string, @Query() query: Record<string, string>) {
    return this.connectorWebhooks.challenge(integrationId, query);
  }

  @Public()
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    void provider; void body; void headers; void req;
    // Provider-level webhooks carry no per-connection secret, so nothing here
    // can authenticate the caller. Signed delivery lives on
    // `webhooks/connectors/:integrationId`.
    throw new GoneException(
      'Unsigned provider webhooks are disabled. Use the connection-specific webhook URL.',
    );
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
    void provider; void body; void headers; void req;
    // Provider-level webhooks carry no per-connection secret, so nothing here
    // can authenticate the caller. Signed delivery lives on
    // `webhooks/connectors/:integrationId`.
    throw new GoneException(
      'Unsigned provider webhooks are disabled. Use the connection-specific webhook URL.',
    );
  }
}
