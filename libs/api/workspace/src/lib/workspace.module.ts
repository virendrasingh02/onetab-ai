import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { StorageModule } from '@org/api-storage';
import { BillingController } from './billing/billing.controller.js';
import { BillingService } from './billing/billing.service.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceSettingsController } from './workspace-settings.controller.js';
import { WorkspaceSettingsService } from './workspace-settings.service.js';
import { WorkspaceAuditController } from './workspace-audit.controller.js';
import { WorkspaceAuditService } from './workspace-audit.service.js';

@Module({
  // AuthModule supplies WorkspaceRoleGuard, which this module's routes use.
  // StorageModule supplies StorageService, which holds uploaded logos.
  imports: [AuthModule, StorageModule],
  controllers: [
    WorkspaceController,
    WorkspaceSettingsController,
    WorkspaceAuditController,
    BillingController,
  ],
  providers: [
    WorkspaceService,
    WorkspaceSettingsService,
    WorkspaceAuditService,
    BillingService,
  ],
  exports: [
    WorkspaceService,
    WorkspaceSettingsService,
    WorkspaceAuditService,
    BillingService,
  ],
})
export class WorkspaceModule {}

