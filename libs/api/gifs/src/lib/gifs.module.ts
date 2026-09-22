import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GifsController } from './gifs.controller.js';
import { GifsService } from './gifs.service.js';
import { StickersController } from './stickers.controller.js';
import { StickersService } from './stickers.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [GifsController, StickersController],
  providers: [GifsService, StickersService],
  exports: [GifsService, StickersService],
})
export class GifsModule {}

