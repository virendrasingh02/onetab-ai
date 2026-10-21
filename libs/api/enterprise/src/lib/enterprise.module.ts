import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { DomainVerificationService } from './domain-verification.service.js';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';
import { OidcSsoService } from './oidc-sso.service.js';
import { SamlService } from './saml.service.js';
import { ScimBearerGuard } from './scim-bearer.guard.js';
import { ScimController } from './scim.controller.js';
import { SCIMService } from './scim.service.js';
import { SsoAuthController } from './sso-auth.controller.js';
import { WorkspaceEnterpriseController } from './workspace-enterprise.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [
    EnterpriseController,
    WorkspaceEnterpriseController,
    SsoAuthController,
    ScimController,
  ],
  providers: [
    EnterpriseService,
    SamlService,
    OidcSsoService,
    DomainVerificationService,
    SCIMService,
    ScimBearerGuard,
  ],
  exports: [
    EnterpriseService,
    SamlService,
    OidcSsoService,
    DomainVerificationService,
    SCIMService,
  ],
})
export class EnterpriseModule {}
