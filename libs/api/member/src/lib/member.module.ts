import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { NotificationsModule } from '@org/api-notifications';
import { WorkspaceModule } from '@org/api-workspace';
import {
  InvitationAcceptController,
  InvitationController,
  InvitationLinkController,
  MemberController,
} from './member.controller.js';
import { MemberService } from './member.service.js';
import { PeopleController } from './people.controller.js';
import { PeopleDispatchService } from './people-dispatch.service.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [AuthModule, WorkspaceModule, NotificationsModule],
  controllers: [
    MemberController,
    InvitationController,
    InvitationLinkController,
    InvitationAcceptController,
    PeopleController,
  ],
  providers: [MemberService, PeopleService, PeopleDispatchService],
  exports: [MemberService, PeopleService],
})
export class MemberModule {}
