import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import {
  InvitationAcceptController,
  InvitationController,
  MemberController,
} from './member.controller.js';
import { MemberService } from './member.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    MemberController,
    InvitationController,
    InvitationAcceptController,
  ],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
