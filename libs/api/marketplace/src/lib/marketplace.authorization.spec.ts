import 'reflect-metadata';
import {
  SYSTEM_ROLES_KEY,
  WORKSPACE_PERMISSIONS_KEY,
} from '@org/api-common';
import { SystemRole, WorkspacePermission } from '@org/types';
import { describe, expect, it } from 'vitest';
import { MarketplaceController } from './marketplace.controller';

const proto = MarketplaceController.prototype as unknown as Record<string, () => void>;
const meta = (key: string, name: string) => Reflect.getMetadata(key, proto[name]);

describe('marketplace authorization (privilege escalation regressions)', () => {
  it.each(['install', 'updateInstallation', 'uninstall', 'resolveApproval'])(
    '%s needs MANAGE_SETTINGS, so guests and plain members cannot call it',
    (name) => {
      expect(meta(WORKSPACE_PERMISSIONS_KEY, name)).toContain(
        WorkspacePermission.MANAGE_SETTINGS,
      );
    },
  );

  it('publishing into the global catalogue is operator-only', () => {
    expect(meta(SYSTEM_ROLES_KEY, 'publishCustom')).toEqual([SystemRole.SUPERADMIN]);
  });
});
