import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { MatrixModule } from '@org/api-matrix';
import { UserController, WorkspaceUserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  imports: [AuthModule, MatrixModule],
  controllers: [UserController, WorkspaceUserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
