import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { UserController, WorkspaceUserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UserController, WorkspaceUserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
