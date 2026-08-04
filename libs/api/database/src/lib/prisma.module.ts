import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global so feature modules can inject `PrismaService` without each one
 * re-importing this module. There is exactly one database connection per
 * process, which makes the global registration honest rather than a shortcut.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
