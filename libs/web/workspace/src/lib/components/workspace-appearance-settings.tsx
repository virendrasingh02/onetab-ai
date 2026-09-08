import { queryKeys, workspaceApi } from '@org/api-client';
import {
  ACCENTS,
  accentTokens,
  DENSITIES,
  RADII,
  THEME_PRESETS,
  type Accent,
  type Density,
  type RadiusPreset,
  type ThemePreset,
} from '@org/design-system';
import {
  WorkspacePermission,
  type ThemeAppearance,
  type ThemeMode,
} from '@org/types';
import { Button, LoadingState, toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentWorkspace } from '../use-workspaces.js';

const MODES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

/**
 * The workspace's *default* appearance / branding — the look every member gets
 * until they set a personal override. Stored per workspace
 * (`WorkspaceSettings.theme`), so changing it here never affects another
 * workspace. Editable only with `MANAGE_SETTINGS`; everyone else sees it
 * read-only.
 *
 * Personal appearance (a member's own light/dark, accent, density for *this*
 * workspace) is edited from the account-level "Appearance & Preferences" panel
 * and is also workspace-scoped.
 */
export function WorkspaceAppearanceSettings() {
  const { workspaceId, permissions } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const canManage =
    permissions?.includes(WorkspacePermission.MANAGE_SETTINGS) ?? false;

  const query = useQuery({
    queryKey: queryKeys.workspaces.appearance(workspaceId ?? ''),
    queryFn: () => workspaceApi.appearance(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<ThemeAppearance>({});

  useEffect(() => {
    if (query.data) setDraft(query.data.workspaceDefault ?? {});
  }, [query.data]);

  const save = useMutation({
    mutationFn: (next: ThemeAppearance) =>
      workspaceApi.saveWorkspaceAppearance(workspaceId as string, next),
    onSuccess: () => {
      // Re-resolve so every open tab in this workspace repaints; other
      // workspaces are keyed separately and untouched.
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.appearance(workspaceId ?? ''),
      });
      toast.success('Workspace appearance updated');
    },
  });

  if (query.isLoading || !query.data) return <LoadingState />;

  const mode: ThemeMode = draft.theme ?? 'light';
  const accent: Accent = (draft.accent as Accent) ?? 'mint';
  const density: Density = (draft.density as Density) ?? 'default';
  const radius: RadiusPreset = (draft.radius as RadiusPreset) ?? 'md';
  const presetId = draft.customTheme?.presetId ?? 'default';

  const patch = (p: Partial<ThemeAppearance>) =>
    setDraft((d) => ({ ...d, ...p }));

  const applyPreset = (preset: ThemePreset) => {
    if (preset.id === 'default') {
      patch({ customTheme: null });
      return;
    }
    patch({ customTheme: { ...preset.config, mode } });
  };

  const isDirty =
    JSON.stringify(draft) !==
    JSON.stringify(query.data.workspaceDefault ?? {});

  return (
    <div className="space-y-8 text-foreground">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Appearance &amp; Branding</h1>
        <p className="text-xs text-muted-foreground mt-1">
          The default theme, accent and branding for this workspace. Members who
          haven&apos;t chosen their own see this. Changing it here does not affect
          any other workspace.
        </p>
      </div>

      {!canManage && (
        <div className="rounded-xl border border-border bg-surface-inset p-3 text-[11px] text-muted-foreground">
          You need the <span className="font-semibold">Manage settings</span>{' '}
          permission to change the workspace appearance. These values are shown
          read-only.
        </div>
      )}

      <fieldset disabled={!canManage} className="space-y-8 disabled:opacity-60">
        {/* Interface mode */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Default color mode
          </h3>
          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4 flex items-center justify-between gap-4">
            <p className="text-[11px] text-muted-foreground">
              Light, dark, or follow each member&apos;s system setting.
            </p>
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
              {MODES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ theme: id })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === id
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Accent */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Accent color
          </h3>
          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4 flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patch({ accent: a })}
                title={a}
                className={`size-7 rounded-full border grid place-items-center transition-all ${
                  accent === a
                    ? 'border-foreground ring-2 ring-primary/30 scale-110'
                    : 'border-border hover:scale-105'
                }`}
                style={{ background: accentTokens[a] }}
              >
                {accent === a && (
                  <Check className="size-3.5 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Brand preset */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Brand theme
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEME_PRESETS.map((preset) => {
              const selected =
                (preset.id === 'default' && presetId === 'default') ||
                presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-2xl border text-left transition-all bg-surface hover:border-border-strong ${
                    selected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-border shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold">{preset.name}</h4>
                    {selected && <Check className="size-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {preset.description}
                  </p>
                  <div className="flex items-center gap-1.5 pt-2">
                    {preset.previewColors.map((c, i) => (
                      <span
                        key={i}
                        className="size-4 rounded-full border border-black/20"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Density & radius */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Density &amp; geometry
          </h3>
          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold">Control density</span>
              <select
                value={density}
                onChange={(e) => patch({ density: e.target.value as Density })}
                className="h-8 rounded-lg border border-border bg-surface px-3 text-xs outline-none"
              >
                {DENSITIES.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold">Corner radius</span>
              <select
                value={radius}
                onChange={(e) =>
                  patch({ radius: e.target.value as RadiusPreset })
                }
                className="h-8 rounded-lg border border-border bg-surface px-3 text-xs outline-none"
              >
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              loading={save.isPending}
              disabled={!isDirty}
              onClick={() => save.mutate(draft)}
              className="text-xs"
            >
              Save workspace appearance
            </Button>
            {isDirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setDraft(query.data.workspaceDefault ?? {})}
              >
                Discard
              </Button>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}
