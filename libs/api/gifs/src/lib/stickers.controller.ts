import { Controller, Get, Query } from '@nestjs/common';
import { StickersService } from './stickers.service.js';

/**
 * Sticker search and catalog endpoints.
 *
 * Provides sticker packs and search without workspace boundaries (stickers
 * are public reaction assets with no tenant data). Authenticated and rate-limited.
 */
@Controller({ path: 'stickers', version: '1' })
export class StickersController {
  constructor(private readonly stickers: StickersService) {}

  @Get('packs')
  getPacks() {
    return this.stickers.getPacks();
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.stickers.searchStickers(q);
  }
}
