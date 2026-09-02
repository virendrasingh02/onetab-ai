import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '@org/api-common';
import { AppService } from './app.service';

@Controller({ version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Liveness probe. Ultra-lightweight so orchestrators can poll frequently. */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }

  /** Readiness probe. Returns 200 when ready to serve traffic, 503 when degraded. */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.appService.ready();
    if (!result.ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}

