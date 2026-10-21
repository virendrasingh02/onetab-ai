import { z } from 'zod';
import { WorkspaceRole } from '@org/types';

export const ssoProviderTypeSchema = z.enum(['SAML', 'OIDC']);

export const saveSSOConfigSchema = z
  .object({
    providerType: ssoProviderTypeSchema.default('SAML'),
    idpName: z.string().trim().max(100).optional(),
    // SAML
    idpEntityId: z.string().trim().min(1, 'Entity ID / Issuer is required for SAML').max(500).optional(),
    ssoUrl: z.string().trim().url('Must be a valid URL').max(1000).optional(),
    certificate: z.string().trim().min(1, 'X.509 Certificate is required for SAML').optional(),
    allowIdpInitiated: z.boolean().default(true),
    forceAuthn: z.boolean().default(false),
    // OIDC
    oidcIssuer: z.string().trim().url('Must be a valid issuer URL').max(500).optional(),
    oidcClientId: z.string().trim().min(1, 'Client ID is required for OIDC').max(200).optional(),
    oidcClientSecret: z.string().trim().max(500).optional(),
    oidcAuthorizationEndpoint: z.string().trim().url().max(1000).optional(),
    oidcTokenEndpoint: z.string().trim().url().max(1000).optional(),
    oidcJwksUri: z.string().trim().url().max(1000).optional(),
    oidcUserInfoEndpoint: z.string().trim().url().max(1000).optional(),
    oidcScopes: z.array(z.string().trim()).default(['openid', 'profile', 'email']),
    // Enforcement & Recovery
    enforceSso: z.boolean().default(false),
    allowPasswordFallbackForAdmins: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.providerType === 'SAML') {
      if (!data.idpEntityId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['idpEntityId'],
          message: 'IdP Entity ID is required when protocol is SAML',
        });
      }
      if (!data.ssoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ssoUrl'],
          message: 'SSO URL is required when protocol is SAML',
        });
      }
      if (!data.certificate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificate'],
          message: 'Signing Certificate is required when protocol is SAML',
        });
      }
    } else if (data.providerType === 'OIDC') {
      if (!data.oidcIssuer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['oidcIssuer'],
          message: 'OIDC Issuer URL is required when protocol is OIDC',
        });
      }
      if (!data.oidcClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['oidcClientId'],
          message: 'OIDC Client ID is required when protocol is OIDC',
        });
      }
    }
  });

export type SaveSSOConfigSchemaInput = z.infer<typeof saveSSOConfigSchema>;

export const domainInputSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Domain must be at least 3 characters')
    .max(255)
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/,
      'Must be a valid domain name (e.g. acme-corp.com)',
    ),
});

export const saveGroupRoleMappingSchema = z.object({
  groupName: z.string().trim().min(1, 'Group name is required').max(150),
  groupId: z.string().trim().max(100).optional(),
  targetWorkspaceId: z.string().trim().optional(),
  targetRole: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});

export const ssoLookupQuerySchema = z.object({
  email: z.string().trim().email('Must be a valid email address'),
});

export const ssoStartQuerySchema = z.object({
  organizationId: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
  desktop: z.enum(['true', 'false']).optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
});

export const ssoRecoveryLoginSchema = z.object({
  email: z.string().trim().email(),
  recoveryCode: z.string().trim().min(8, 'Invalid recovery code'),
});
