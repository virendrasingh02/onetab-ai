import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRole } from '@org/types';
import { WorkspaceSettingsService } from './workspace-settings.service.js';

describe('WorkspaceSettingsService', () => {
  let service: WorkspaceSettingsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      workspaceSettings: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      workspaceThemePreference: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      themeSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    service = new WorkspaceSettingsService(prisma);
  });

  describe('getAppearance', () => {
    it('returns the design-system default when nothing is stored', async () => {
      const res = await service.getAppearance(
        'ws_1',
        'user_1',
        WorkspaceRole.MEMBER,
      );
      expect(res.workspaceDefault).toEqual({});
      expect(res.memberOverride).toEqual({});
      expect(res.resolved).toMatchObject({ theme: 'light', accent: 'mint' });
    });

    it('layers member override over workspace default over user-global', async () => {
      prisma.themeSetting.findUnique.mockResolvedValue({
        data: { theme: 'system', radius: 'lg' },
      });
      prisma.workspaceSettings.findUnique.mockResolvedValue({
        data: undefined,
        theme: { theme: 'dark', accent: 'blue' },
      });
      prisma.workspaceThemePreference.findUnique.mockResolvedValue({
        data: { theme: 'light' },
      });

      const res = await service.getAppearance(
        'ws_1',
        'user_1',
        WorkspaceRole.ADMIN,
      );

      expect(res.resolved.theme).toBe('light'); // member override wins
      expect(res.resolved.accent).toBe('blue'); // workspace default
      expect(res.resolved.radius).toBe('lg'); // user-global fallback
      expect(res.canManageDefault).toBe(true);
    });

    it('reports canManageDefault=false for a plain member', async () => {
      const res = await service.getAppearance(
        'ws_1',
        'user_1',
        WorkspaceRole.MEMBER,
      );
      expect(res.canManageDefault).toBe(false);
    });

    it('keeps two workspaces isolated', async () => {
      prisma.workspaceSettings.findUnique.mockImplementation(
        ({ where }: { where: { workspaceId: string } }) =>
          Promise.resolve(
            where.workspaceId === 'ws_A'
              ? { theme: { theme: 'dark', accent: 'blue' } }
              : { theme: { theme: 'light', accent: 'green' } },
          ),
      );

      const a = await service.getAppearance('ws_A', 'u', WorkspaceRole.OWNER);
      const b = await service.getAppearance('ws_B', 'u', WorkspaceRole.OWNER);

      expect(a.resolved).toMatchObject({ theme: 'dark', accent: 'blue' });
      expect(b.resolved).toMatchObject({ theme: 'light', accent: 'green' });
    });
  });

  describe('saveWorkspaceDefault', () => {
    it('shallow-merges the patch over the stored default', async () => {
      prisma.workspaceSettings.findUnique.mockResolvedValue({
        theme: { accent: 'blue', customTheme: { presetId: 'ocean' } },
      });
      prisma.workspaceSettings.upsert.mockResolvedValue({
        theme: {
          accent: 'blue',
          customTheme: { presetId: 'ocean' },
          theme: 'dark',
        },
      });

      await service.saveWorkspaceDefault('ws_1', { theme: 'dark' });

      const arg = prisma.workspaceSettings.upsert.mock.calls[0][0];
      expect(arg.create.theme).toMatchObject({
        accent: 'blue',
        theme: 'dark',
        customTheme: { presetId: 'ocean' },
      });
      expect(arg.update.theme).toMatchObject({ accent: 'blue', theme: 'dark' });
    });
  });

  describe('saveMemberOverride', () => {
    it('writes the caller/workspace row and never the workspace default', async () => {
      prisma.workspaceThemePreference.upsert.mockResolvedValue({
        data: { theme: 'dark' },
      });

      await service.saveMemberOverride('ws_1', 'user_1', { theme: 'dark' });

      expect(prisma.workspaceThemePreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId_userId: { workspaceId: 'ws_1', userId: 'user_1' } },
        }),
      );
      expect(prisma.workspaceSettings.upsert).not.toHaveBeenCalled();
    });
  });

  describe('resetMemberOverride', () => {
    it('deletes only the caller/workspace row', async () => {
      await service.resetMemberOverride('ws_1', 'user_1');
      expect(prisma.workspaceThemePreference.deleteMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws_1', userId: 'user_1' },
      });
    });
  });
});
