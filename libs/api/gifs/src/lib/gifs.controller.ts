import { Controller, Get, Query } from '@nestjs/common';
import { GifsService } from './gifs.service.js';

/**
 * GIF search, proxied through Tenor.
 *
 * Not workspace-scoped — GIF results are the same for everyone and carry no
 * tenant data. The global `JwtAuthGuard` and `ThrottlerGuard` still apply, so
 * only signed-in users reach it and the rate limit is shared with the rest of
 * the API.
 */
@Controller({ path: 'gifs', version: '1' })
export class GifsController {
  constructor(private readonly gifs: GifsService) {}

  @Get('trending')
  trending(@Query('limit') limit?: string, @Query('pos') pos?: string) {
    return this.gifs.trending(clampLimit(limit), pos);
  }

  @Get('search')
  search(
    @Query('q') q = '',
    @Query('limit') limit?: string,
    @Query('pos') pos?: string,
  ) {
    return this.gifs.search(q, clampLimit(limit), pos);
  }

  @Get('categories')
  categories() {
    return this.gifs.categories();
  }
}

/** Tenor caps `limit` at 50; keep our own ceiling in step. */
function clampLimit(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 24;
  return Math.min(Math.trunc(n), 50);
}
