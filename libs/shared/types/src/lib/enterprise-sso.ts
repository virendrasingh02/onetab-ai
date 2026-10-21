import type { IsoDateString } from './entities.js';
import type { WorkspaceRole } from './enums.js';

export type SSOProviderType = 'SAML' | 'OIDC';

export interface EnterpriseSSOConfigDto {
  id: string;
  organizationId: string;
  providerType: SSOProviderType;
  idpName: string | null;
  // SAML Configuration
  idpEntityId: string | null;
  ssoUrl: string | null;
  certificate: string | null;
  spEntityId: string;
  acsUrl: string;
  metadataUrl: string;
  allowIdpInitiated: boolean;
  forceAuthn: boolean;
  // OIDC Configuration
  oidcIssuer: string | null;
  oidcClientId: string | null;
  hasOidcClientSecret: boolean;
  oidcAuthorizationEndpoint: string | null;
  oidcTokenEndpoint: string | null;
  oidcJwksUri: string | null;
  oidcUserInfoEndpoint: string | null;
  oidcScopes: string[];
  // Domain Verification
  verifiedDomains: string[];
  domainVerificationToken: string | null;
  domainVerifiedAt: IsoDateString | null;
  // SSO Enforcement & Recovery
  enforceSso: boolean;
  allowPasswordFallbackForAdmins: boolean;
  hasRecoveryCode: boolean;
  // SCIM 2.0 Configuration
  scimEnabled: boolean;
  scimEndpoint: string;
  scimTokenPrefix: string | null;
  scimTokenExpiresAt: IsoDateString | null;
  scimLastSyncAt: IsoDateString | null;
  // Diagnostics
  lastConnectionTestAt: IsoDateString | null;
  lastConnectionTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastConnectionTestMessage: string | null;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SaveSSOConfigInput {
  providerType: SSOProviderType;
  idpName?: string;
  // SAML
  idpEntityId?: string;
  ssoUrl?: string;
  certificate?: string;
  allowIdpInitiated?: boolean;
  forceAuthn?: boolean;
  // OIDC
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcAuthorizationEndpoint?: string;
  oidcTokenEndpoint?: string;
  oidcJwksUri?: string;
  oidcUserInfoEndpoint?: string;
  oidcScopes?: string[];
  // Enforcement
  enforceSso?: boolean;
  allowPasswordFallbackForAdmins?: boolean;
}

export interface SSOConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  timestamp: IsoDateString;
}

export interface DomainVerificationDto {
  domain: string;
  verified: boolean;
  verificationToken: string;
  verifiedAt: IsoDateString | null;
  txtRecordName: string;
  txtRecordValue: string;
}

export interface RotateScimTokenResponse {
  rawToken: string;
  tokenPrefix: string;
  expiresAt: IsoDateString | null;
}

export interface GenerateRecoveryCodeResponse {
  recoveryCode: string;
  generatedAt: IsoDateString;
}

export interface SSOGroupRoleMappingDto {
  id: string;
  organizationId: string;
  groupName: string;
  groupId: string | null;
  targetWorkspaceId: string | null;
  targetRole: WorkspaceRole;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SaveGroupRoleMappingInput {
  groupName: string;
  groupId?: string;
  targetWorkspaceId?: string;
  targetRole: WorkspaceRole;
}

export interface SSOLookupResponse {
  ssoAvailable: boolean;
  organizationId?: string;
  providerType?: SSOProviderType;
  idpName?: string;
  enforceSso?: boolean;
}

/* -------------------------------------------------------------------------- */
/* SCIM 2.0 RFC 7643 / RFC 7644 Contracts                                    */
/* -------------------------------------------------------------------------- */

export interface SCIMUserEmail {
  value: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMUserName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface SCIMUserRole {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMUserResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  displayName: string;
  name?: SCIMUserName;
  emails: SCIMUserEmail[];
  roles?: SCIMUserRole[];
  active: boolean;
  meta: {
    resourceType: 'User';
    created: IsoDateString;
    lastModified: IsoDateString;
    location: string;
  };
}

export interface SCIMGroupMemberRef {
  value: string;
  $ref?: string;
  display?: string;
}

export interface SCIMGroupResource {
  schemas: string[];
  id: string;
  displayName: string;
  externalId?: string;
  members: SCIMGroupMemberRef[];
  meta: {
    resourceType: 'Group';
    created: IsoDateString;
    lastModified: IsoDateString;
    location: string;
  };
}

export interface SCIMListResponse<T> {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface SCIMPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'Add' | 'Remove' | 'Replace';
  path?: string;
  value?: unknown;
}

export interface SCIMPatchRequest {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'];
  Operations: SCIMPatchOperation[];
}

export interface SCIMErrorResponse {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'];
  status: string;
  scimType?: string;
  detail: string;
}
