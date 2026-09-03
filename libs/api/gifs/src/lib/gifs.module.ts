import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GifsController } from './gifs.controller.js';
import { GifsService } from './gifs.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [GifsController],
  providers: [GifsService],
  exports: [GifsService],
})
export class GifsModule {}
