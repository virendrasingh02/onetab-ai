import { Controller, Get } from '@nestjs/common';
import { Public } from '@org/api-common';
import { AppService } from './app.service';

@Controller({ version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Liveness probe. Public so orchestrators can poll it without a token. */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }
}
