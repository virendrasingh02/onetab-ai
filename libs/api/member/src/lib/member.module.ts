import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { WorkspaceModule } from '@org/api-workspace';
import {
  InvitationAcceptController,
  InvitationController,
  InvitationLinkController,
  MemberController,
} from './member.controller.js';
import { MemberService } from './member.service.js';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [
    MemberController,
    InvitationController,
    InvitationLinkController,
    InvitationAcceptController,
  ],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
