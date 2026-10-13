import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { StorageModule } from '@org/api-storage';
import { AdminBillingController } from './billing/admin-billing.controller.js';
import { AdminBillingService } from './billing/admin-billing.service.js';
import { BillingAuditService } from './billing/billing-audit.service.js';
import { BillingController } from './billing/billing.controller.js';
import { BillingLifecycleService } from './billing/billing-lifecycle.service.js';
import { BillingService } from './billing/billing.service.js';
import { BillingWebhookController } from './billing/billing-webhook.controller.js';
import { BillingWebhookService } from './billing/billing-webhook.service.js';
import { CheckoutService } from './billing/checkout.service.js';
import { CreditService } from './billing/credit.service.js';
import { PAYMENT_PROVIDER } from './billing/payment-provider.js';
import { PromotionService } from './billing/promotion.service.js';
import { StripeProvider } from './billing/stripe.provider.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceSettingsController } from './workspace-settings.controller.js';
import { WorkspaceSettingsService } from './workspace-settings.service.js';
import { WorkspaceAuditController } from './workspace-audit.controller.js';
import { WorkspaceAuditService } from './workspace-audit.service.js';

@Module({
  // AuthModule supplies WorkspaceRoleGuard, which this module's routes use.
  // StorageModule supplies StorageService, which holds uploaded logos.
  imports: [AuthModule, StorageModule, ConfigModule],
  controllers: [
    WorkspaceController,
    WorkspaceSettingsController,
    WorkspaceAuditController,
    BillingController,
    BillingWebhookController,
    AdminBillingController,
  ],
  providers: [
    WorkspaceService,
    WorkspaceSettingsService,
    WorkspaceAuditService,
    BillingService,
    CreditService,
    PromotionService,
    BillingAuditService,
    CheckoutService,
    BillingWebhookService,
    BillingLifecycleService,
    AdminBillingService,
    StripeProvider,
    // Swap this binding to change payment processor; nothing else imports Stripe.
    { provide: PAYMENT_PROVIDER, useExisting: StripeProvider },
  ],
  exports: [
    WorkspaceService,
    WorkspaceSettingsService,
    WorkspaceAuditService,
    BillingService,
    CreditService,
    PromotionService,
    CheckoutService,
  ],
})
export class WorkspaceModule {}
