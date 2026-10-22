import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES_KEY } from '@org/api-common';
import { SystemRole } from '@org/types';
import { describe, expect, it } from 'vitest';
import { SystemRoleGuard } from './guards';

class Admin {
  guarded() {
    return 1;
  }
  undecorated() {
    return 2;
  }
}
Reflect.defineMetadata(SYSTEM_ROLES_KEY, [SystemRole.SUPERADMIN], Admin.prototype.guarded);

const ctx = (handler: () => unknown, user?: { systemRole: SystemRole }) =>
  ({
    getHandler: () => handler,
    getClass: () => Admin,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as never;

describe('SystemRoleGuard (admin authorization is server-side and fails closed)', () => {
  const guard = new SystemRoleGuard(new Reflector());
  const proto = Admin.prototype;

  it('refuses unauthenticated callers', () => {
    expect(() => guard.canActivate(ctx(proto.guarded))).toThrow(ForbiddenException);
  });

  it('hides operator routes from ordinary users (privilege escalation)', () => {
    expect(() => guard.canActivate(ctx(proto.guarded, { systemRole: SystemRole.USER }))).toThrow(
      NotFoundException,
    );
  });

  it('lets the required role through', () => {
    expect(guard.canActivate(ctx(proto.guarded, { systemRole: SystemRole.SUPERADMIN }))).toBe(true);
  });

  it('admits nobody to a route that forgot its decorator', () => {
    expect(() =>
      guard.canActivate(ctx(proto.undecorated, { systemRole: SystemRole.SUPERADMIN })),
    ).toThrow(NotFoundException);
  });
});
