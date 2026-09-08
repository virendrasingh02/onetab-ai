import { describe, expect, it } from 'vitest';
import {
  DESIGN_SYSTEM_DEFAULT_APPEARANCE,
  resolveWorkspaceAppearance,
} from './appearance.js';

describe('resolveWorkspaceAppearance', () => {
  it('falls back to the design-system default when every layer is empty', () => {
    expect(resolveWorkspaceAppearance({})).toEqual(
      DESIGN_SYSTEM_DEFAULT_APPEARANCE,
    );
    expect(
      resolveWorkspaceAppearance({
        memberOverride: {},
        workspaceDefault: {},
        userGlobal: {},
      }),
    ).toEqual(DESIGN_SYSTEM_DEFAULT_APPEARANCE);
  });

  it('uses the workspace default when there is no member override', () => {
    const resolved = resolveWorkspaceAppearance({
      workspaceDefault: { theme: 'dark', accent: 'blue' },
    });
    expect(resolved.theme).toBe('dark');
    expect(resolved.accent).toBe('blue');
    // Untouched fields still fall through to the design-system default.
    expect(resolved.radius).toBe(DESIGN_SYSTEM_DEFAULT_APPEARANCE.radius);
  });

  it('lets the member override beat the workspace default, field by field', () => {
    const resolved = resolveWorkspaceAppearance({
      memberOverride: { theme: 'light' },
      workspaceDefault: { theme: 'dark', accent: 'blue' },
    });
    // member wins on `theme`, workspace default still supplies `accent`.
    expect(resolved.theme).toBe('light');
    expect(resolved.accent).toBe('blue');
  });

  it('uses the legacy user-global blob only below the workspace layers', () => {
    expect(
      resolveWorkspaceAppearance({
        userGlobal: { theme: 'dark', accent: 'rose' },
      }),
    ).toMatchObject({ theme: 'dark', accent: 'rose' });

    expect(
      resolveWorkspaceAppearance({
        workspaceDefault: { theme: 'light' },
        userGlobal: { theme: 'dark', accent: 'rose' },
      }),
    ).toMatchObject({ theme: 'light', accent: 'rose' });
  });

  it('treats customTheme atomically and honours an explicit null override', () => {
    const brand = { mode: 'dark', type: 'preset', presetId: 'ocean' } as never;

    expect(
      resolveWorkspaceAppearance({ workspaceDefault: { customTheme: brand } })
        .customTheme,
    ).toBe(brand);

    // An explicit null on a higher layer clears the lower layer's brand theme.
    expect(
      resolveWorkspaceAppearance({
        memberOverride: { customTheme: null },
        workspaceDefault: { customTheme: brand },
      }).customTheme,
    ).toBeNull();
  });

  it('keeps two workspaces independent', () => {
    const workspaceA = resolveWorkspaceAppearance({
      workspaceDefault: { theme: 'dark', accent: 'blue' },
    });
    const workspaceB = resolveWorkspaceAppearance({
      workspaceDefault: { theme: 'light', accent: 'green' },
    });
    expect(workspaceA).toMatchObject({ theme: 'dark', accent: 'blue' });
    expect(workspaceB).toMatchObject({ theme: 'light', accent: 'green' });
  });
});
