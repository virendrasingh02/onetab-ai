import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCIMService } from './scim.service.js';
import type { PrismaService } from '@org/database';
import { MembershipStatus } from '@org/types';

describe('SCIMService', () => {
  let scimService: SCIMService;
  let mockPrisma: any;
  const baseUrl = 'https://app.mie.ai/api/v1/scim/v2';
  const orgId = 'org-corp-123';

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({
          id: orgId,
          domain: 'corp.com',
          verifiedDomains: ['corp.com'],
          workspaces: [{ id: 'ws-main' }],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: orgId,
          domain: 'corp.com',
          verifiedDomains: ['corp.com'],
          workspaces: [{ id: 'ws-main' }],
        }),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspaceMember: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      refreshToken: {
        deleteMany: vi.fn(),
      },
      sSOConfig: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      sSOGroupRoleMapping: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      sCIMGroup: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sCIMGroupMember: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      enterpriseAuditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    scimService = new SCIMService(mockPrisma as unknown as PrismaService);
  });

  describe('RFC 7643 Discovery Endpoints', () => {
    it('returns valid ServiceProviderConfig according to RFC 7643 section 5', () => {
      const config = scimService.getServiceProviderConfig(baseUrl);

      expect(config.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig');
      expect(config.patch.supported).toBe(true);
      expect(config.filter.supported).toBe(true);
      expect(config.filter.maxResults).toBe(100);
      expect(config.authenticationSchemes).toHaveLength(1);
      expect(config.authenticationSchemes[0].type).toBe('oauthbearertoken');
    });

    it('returns RFC 7643 Schemas containing User and Group definitions', () => {
      const schemas = scimService.getSchemas(baseUrl);

      expect(schemas.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse');
      expect(schemas.totalResults).toBe(2);
      const userSchema = schemas.Resources.find(
        (r) => r.id === 'urn:ietf:params:scim:schemas:core:2.0:User',
      );
      expect(userSchema).toBeDefined();
      expect(userSchema?.name).toBe('User');
    });

    it('returns RFC 7643 ResourceTypes for Users and Groups', () => {
      const resources = scimService.getResourceTypes(baseUrl);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.name)).toContain('User');
      expect(resources.map((r) => r.name)).toContain('Group');
    });
  });

  describe('User Provisioning & Deprovisioning (RFC 7644)', () => {
    it('lists users with RFC 7644 pagination structure', async () => {
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'alice@corp.com',
          name: 'Alice Smith',
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceMembers: [{ role: 'MEMBER', status: MembershipStatus.ACTIVE }],
        },
      ]);

      const result = await scimService.listUsers(orgId, { startIndex: 1, count: 10 }, baseUrl);

      expect(result.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse');
      expect(result.totalResults).toBe(1);
      expect(result.itemsPerPage).toBe(1);
      expect(result.startIndex).toBe(1);
      expect(result.Resources[0].userName).toBe('alice@corp.com');
      expect(result.Resources[0].active).toBe(true);
    });

    it('deactivates a user on PATCH with active: false (soft deprovisioning)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'alice@corp.com',
        name: 'Alice Smith',
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceMembers: [{ role: 'MEMBER', status: MembershipStatus.ACTIVE }],
      };

      // Mock user lookup before and after update
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({
          ...mockUser,
          workspaceMembers: [{ role: 'MEMBER', status: MembershipStatus.SUSPENDED }],
        });

      const updated = await scimService.patchUser(
        orgId,
        'user-1',
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [
            {
              op: 'replace',
              path: 'active',
              value: false,
            },
          ],
        },
        baseUrl,
      );

      // Verifies workspace members were suspended and refresh tokens revoked
      expect(mockPrisma.workspaceMember.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          workspaceId: { in: ['ws-main'] },
        },
        data: { status: MembershipStatus.SUSPENDED },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      // Verifies audit log was recorded
      expect(mockPrisma.enterpriseAuditLog.create).toHaveBeenCalled();
      // Returned SCIM user reports inactive
      expect(updated.active).toBe(false);
    });
  });
});
