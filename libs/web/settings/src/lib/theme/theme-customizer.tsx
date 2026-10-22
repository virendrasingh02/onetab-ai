import { queryKeys, workspaceApi } from '@org/api-client';
import {
  ACTIVE_WORKSPACE_STORAGE_KEY,
  checkContrast,
  downloadThemeConfigFile,
  generateThemeVariables,
  isValidHexColor,
  THEME_PRESETS,
  type ThemePreset,
  useTheme,
  validateAndParseThemeConfig,
} from '@org/design-system';
import type { GradientConfig, ThemeColorsConfig, ThemeConfig } from '@org/types';
import { Button, toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Download,
  Eye,
  Loader2,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Undo2,
  Upload,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GradientEditor } from './gradient-editor.js';
import { HexInput } from './hex-input.js';

type EditMode = 'light' | 'dark';
type ColorKey =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'background'
  | 'foreground'
  | 'ring'
  | 'card'
  | 'muted'
  | 'border'
  | 'input'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

interface ColorField {
  key: ColorKey;
  label: string;
}

const COLOR_GROUPS: ReadonlyArray<{ title: string; columns: string; fields: ColorField[] }> = [
  {
    title: 'Brand & canvas',
    columns: 'lg:grid-cols-3',
    fields: [
      { key: 'primary', label: 'Primary brand' },
      { key: 'secondary', label: 'Secondary surface' },
      { key: 'accent', label: 'Accent & hover' },
      { key: 'background', label: 'Background canvas' },
      { key: 'foreground', label: 'Text / foreground' },
      { key: 'ring', label: 'Focus ring' },
    ],
  },
  {
    title: 'Surfaces, muted & borders',
    columns: 'lg:grid-cols-4',
    fields: [
      { key: 'card', label: 'Card & panel' },
      { key: 'muted', label: 'Muted elements' },
      { key: 'border', label: 'Border hairline' },
      { key: 'input', label: 'Input background' },
    ],
  },
  {
    title: 'Status & notification',
    columns: 'lg:grid-cols-4',
    fields: [
      { key: 'success', label: 'Success' },
      { key: 'warning', label: 'Warning' },
      { key: 'destructive', label: 'Destructive' },
      { key: 'info', label: 'Info' },
    ],
  },
];

const GRADIENT_SLOTS = [
  { slot: 'primary', label: 'Primary gradient (--gradient-primary)' },
  { slot: 'accent', label: 'Accent gradient (--gradient-accent)' },
  { slot: 'background', label: 'Background gradient (--gradient-background)' },
  { slot: 'hero', label: 'Hero gradient (--gradient-hero)' },
  { slot: 'button', label: 'Button gradient (--gradient-button)' },
] as const;

/** Keys that older builds stored as one palette shared by both modes. */
const LEGACY_SURFACE_KEYS: ColorKey[] = [
  'secondary',
  'accent',
  'background',
  'foreground',
  'card',
  'muted',
  'border',
  'input',
];

function blankConfig(mode: ThemeConfig['mode']): ThemeConfig {
  return { mode, type: 'default' };
}

/**
 * Older saves kept surface colours in `colors`, which paints in *both* modes —
 * a light `foreground` over a generated dark surface is how the customizer ended
 * up dark-on-dark. Move those into the per-mode palette they were authored for.
 */
function migrateLegacyPalette(config: ThemeConfig): ThemeConfig {
  const colors = config.colors;
  if (config.modeColors || !colors) return config;
  const moved: Partial<ThemeColorsConfig> = {};
  const kept: Partial<ThemeColorsConfig> = { ...colors };
  for (const key of LEGACY_SURFACE_KEYS) {
    if (colors[key]) {
      moved[key] = colors[key];
      delete kept[key];
    }
  }
  if (Object.keys(moved).length === 0) return config;
  const target: EditMode = config.mode === 'dark' ? 'dark' : 'light';
  return { ...config, colors: kept, modeColors: { [target]: moved } };
}

/** Comparison key — the painted mode is the user's Color Mode, not part of the palette. */
function fingerprint(config: ThemeConfig): string {
  return JSON.stringify({ ...config, mode: undefined });
}

function readActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface ThemeCustomizerProps {
  onSaved?: () => void;
  className?: string;
}

export function ThemeCustomizer({ onSaved, className = '' }: ThemeCustomizerProps) {
  const { theme, resolvedTheme, customTheme, setCustomTheme, setDraftTheme } = useTheme();
  const queryClient = useQueryClient();
  const workspaceId = useMemo(readActiveWorkspaceId, []);

  const saved = useMemo(() => customTheme ?? blankConfig(theme), [customTheme, theme]);
  const [draft, setDraft] = useState<ThemeConfig>(() => migrateLegacyPalette(saved));
  const [activeTab, setActiveTab] = useState<'flat' | 'gradients'>('flat');
  const [editMode, setEditMode] = useState<EditMode>(resolvedTheme);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const dirty = fingerprint(draft) !== fingerprint(saved);

  // Paint the draft app-wide while it differs from what's saved; otherwise let
  // the saved theme show. Cleared on unmount so abandoned edits never stick.
  useEffect(() => {
    setDraftTheme(dirty ? { ...draft, mode: theme } : null);
  }, [dirty, draft, theme, setDraftTheme]);
  useEffect(() => () => setDraftTheme(null), [setDraftTheme]);

  // Whether the caller may also publish this as the workspace default. Shares
  // its cache entry with the appearance sync, so no extra request in practice.
  const appearance = useQuery({
    queryKey: queryKeys.workspaces.appearance(workspaceId ?? ''),
    queryFn: () => workspaceApi.appearance(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const canManageDefault = appearance.data?.canManageDefault === true;

  const overrides = draft.modeColors?.[editMode] ?? {};

  // What each token resolves to with this mode's overrides removed — the real
  // generated defaults, so "reset" lands on exactly what the app would paint.
  const defaults = useMemo(
    () =>
      generateThemeVariables(
        { ...draft, modeColors: { ...draft.modeColors, [editMode]: undefined } },
        undefined,
        editMode,
      ),
    [draft, editMode],
  );

  const valueOf = (key: ColorKey): string => overrides[key] ?? defaults[`--color-${key}`] ?? '#000000';

  const setColor = (key: ColorKey, hex: string) => {
    setDraft((prev) => ({
      ...prev,
      type: 'custom',
      presetId: undefined,
      modeColors: {
        ...prev.modeColors,
        [editMode]: { ...prev.modeColors?.[editMode], [key]: hex },
      },
    }));
  };

  const resetColor = (key: ColorKey) => {
    setDraft((prev) => {
      const next = { ...prev.modeColors?.[editMode] };
      delete next[key];
      return {
        ...prev,
        modeColors: { ...prev.modeColors, [editMode]: Object.keys(next).length ? next : undefined },
      };
    });
  };

  const resetPalette = () => {
    setDraft((prev) => ({ ...prev, modeColors: { ...prev.modeColors, [editMode]: undefined } }));
    toast.success(`${editMode === 'dark' ? 'Dark' : 'Light'} colors reset to defaults`);
  };

  const setGradient = (slot: string, grad: GradientConfig) => {
    setDraft((prev) => ({
      ...prev,
      type: 'custom',
      presetId: undefined,
      gradients: { ...prev.gradients, [slot]: grad },
    }));
  };

  const resetGradient = (slot: string) => {
    setDraft((prev) => {
      const next = { ...prev.gradients };
      delete next[slot as keyof typeof next];
      return { ...prev, gradients: Object.keys(next).length ? next : undefined };
    });
  };

  const applyPreset = (preset: ThemePreset) => {
    // A preset is a brand identity: it replaces colours and gradients but keeps
    // the user's Color Mode, and surfaces are derived for whichever mode paints.
    setDraft({ ...preset.config, mode: theme });
    toast.success(`${preset.name} preset loaded — save to apply`);
  };

  const resetAll = () => {
    setDraft(blankConfig(theme));
    toast.success('Back to the platform default — save to apply');
  };

  const discard = () => setDraft(migrateLegacyPalette(saved));

  const saveMine = useMutation({
    mutationFn: async (next: ThemeConfig | null) => {
      if (workspaceId) {
        await workspaceApi.saveMyWorkspaceAppearance(workspaceId, { customTheme: next });
      }
      return next;
    },
    onSuccess: async (next) => {
      setCustomTheme(next);
      if (workspaceId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.appearance(workspaceId),
        });
      }
      toast.success('Theme saved');
      onSaved?.();
    },
    onError: () => toast.error('Could not save your theme. Your changes are still here — try again.'),
  });

  const saveDefault = useMutation({
    mutationFn: async (next: ThemeConfig | null) => {
      await workspaceApi.saveWorkspaceAppearance(workspaceId as string, { customTheme: next });
      // The admin's own view follows what they just published.
      await workspaceApi.saveMyWorkspaceAppearance(workspaceId as string, { customTheme: next });
      return next;
    },
    onSuccess: async (next) => {
      setCustomTheme(next);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.appearance(workspaceId as string),
      });
      toast.success('Workspace default updated. Members with their own theme keep theirs.');
      onSaved?.();
    },
    onError: () => toast.error('Could not update the workspace default.'),
  });

  const buildSaveTarget = (): ThemeConfig | null => {
    const isBlank = fingerprint(draft) === fingerprint(blankConfig(theme));
    return isBlank ? null : { ...draft, mode: theme };
  };

  const saving = saveMine.isPending || saveDefault.isPending;

  const handleExport = () => {
    downloadThemeConfigFile({ ...draft, mode: theme }, 'platform-color-theme.json');
    toast.success('Exported platform-color-theme.json');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = validateAndParseThemeConfig(String(event.target?.result ?? ''));
      if (result.success && result.config) {
        setDraft(migrateLegacyPalette({ ...result.config, mode: theme }));
        toast.success('Imported — review the preview, then save.');
      } else {
        toast.error(result.error || 'Failed to import theme configuration.');
      }
    };
    reader.onerror = () => toast.error('Could not read the uploaded file.');
    reader.readAsText(file);
  };

  // WCAG checks for the palette being edited.
  const primary = valueOf('primary');
  const background = valueOf('background');
  const foreground = valueOf('foreground');
  const buttonContrast = checkContrast(
    defaults['--color-primary-foreground'] ?? '#ffffff',
    isValidHexColor(primary) ? primary : '#000000',
  );
  const bodyContrast = checkContrast(
    isValidHexColor(foreground) ? foreground : '#000000',
    isValidHexColor(background) ? background : '#ffffff',
  );

  // The preview always renders in the mode being edited, even when the app is
  // painted in the other one.
  const previewVars = useMemo(
    () => generateThemeVariables({ ...draft, mode: editMode }, undefined, editMode) as CSSProperties,
    [draft, editMode],
  );

  return (
    <div
      className={`rounded-xl border border-border bg-surface text-foreground shadow-xs p-5 sm:p-6 space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span>Platform color &amp; gradient customizer</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tune colors per mode and see the result live. Nothing is saved until you press Save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => importInputRef.current?.click()}>
            <Upload className="size-3.5" />
            <span>Import JSON</span>
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={handleExport}>
            <Download className="size-3.5" />
            <span>Export JSON</span>
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Predefined color themes</span>
          </span>
          <span className="text-[11px] text-muted-foreground">Replaces your colors with the preset</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {THEME_PRESETS.map((preset) => {
            const active =
              draft.presetId === preset.id || (preset.id === 'default' && draft.type === 'default');
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                title={preset.description}
                aria-pressed={active}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col space-y-2 ${
                  active
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                    : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold truncate">{preset.name}</span>
                  {active && <Check className="size-3 text-primary shrink-0" />}
                </div>
                <div className="flex items-center gap-1">
                  {preset.previewColors.slice(0, 3).map((col, idx) => (
                    <span
                      key={idx}
                      className="size-3.5 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section tabs + the mode being edited */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-2">
        {(
          [
            { id: 'flat', label: 'Flat colors', icon: Palette },
            { id: 'gradients', label: 'Gradients', icon: Sparkles },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              activeTab === id
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-surface-raised'
            }`}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        ))}

        {activeTab === 'flat' && (
          <div
            role="radiogroup"
            aria-label="Palette being edited"
            className="ml-auto flex items-center gap-1 bg-surface-inset p-1 rounded-lg border border-border"
          >
            {(
              [
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={editMode === id}
                onClick={() => setEditMode(id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  editMode === id
                    ? 'bg-background text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'flat' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Editing the <strong className="text-foreground">{editMode}</strong> palette
              {editMode !== resolvedTheme && ' — switch Interface mode above to see it across the app'}.
              Untouched colors are generated from your brand color.
            </p>
            <button
              type="button"
              onClick={resetPalette}
              disabled={Object.keys(overrides).length === 0}
              className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset {editMode} colors</span>
            </button>
          </div>

          {COLOR_GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h4>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${group.columns} gap-3.5`}>
                {group.fields.map((field) => (
                  <ColorFieldItem
                    key={`${editMode}-${field.key}`}
                    label={field.label}
                    token={`--color-${field.key}`}
                    value={valueOf(field.key)}
                    overridden={overrides[field.key] !== undefined}
                    onChange={(hex) => setColor(field.key, hex)}
                    onReset={() => resetColor(field.key)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="p-3.5 rounded-xl border border-border bg-surface-raised text-xs space-y-1">
            <span className="font-bold flex items-center gap-2">
              <span>Accessibility &amp; contrast</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  buttonContrast.passesAA && bodyContrast.passesAA
                    ? 'bg-success/15 text-success'
                    : 'bg-destructive/15 text-destructive'
                }`}
              >
                {buttonContrast.passesAA && bodyContrast.passesAA ? 'AA pass' : 'Needs attention'}
              </span>
            </span>
            <p className="text-[11px] text-muted-foreground">
              Primary button label: <strong className="text-foreground">{buttonContrast.formattedRatio}</strong>
              {' · '}
              Body text on canvas: <strong className="text-foreground">{bodyContrast.formattedRatio}</strong>
            </p>
          </div>
        </div>
      )}

      {activeTab === 'gradients' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Platform gradients
            </h4>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, gradients: undefined }))}
              disabled={!draft.gradients}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset gradients</span>
            </button>
          </div>
          {GRADIENT_SLOTS.map(({ slot, label }) => (
            <GradientEditor
              key={slot}
              label={label}
              value={draft.gradients?.[slot]}
              onChange={(grad) => setGradient(slot, grad)}
              onReset={() => resetGradient(slot)}
            />
          ))}
        </div>
      )}

      {/* Live preview, rendered in the mode being edited */}
      <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-surface-raised space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <Eye className="size-3.5 text-primary" />
            <span>Preview · {editMode}</span>
          </span>
          <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
            {dirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>
        <div
          style={previewVars}
          className={`${editMode === 'dark' ? 'dark' : ''} p-4 sm:p-5 rounded-xl border border-border bg-background text-foreground space-y-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-lg flex items-center justify-center font-bold text-xs"
                style={{ background: 'var(--gradient-primary, var(--primary))', color: 'var(--primary-foreground)' }}
              >
                AI
              </div>
              <div>
                <h4 className="text-xs font-bold">OneTab color engine</h4>
                <p className="text-[11px] text-muted-foreground">Tokens rendered live</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md border border-border bg-card text-xs">Outline</span>
              <span className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                Primary
              </span>
              <span
                className="px-2.5 py-1 rounded-md text-xs font-medium"
                style={{
                  background: 'var(--gradient-button, var(--gradient-primary, var(--primary)))',
                  color: 'var(--primary-foreground)',
                }}
              >
                Gradient
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
            <div className="h-8 rounded-md border border-input bg-card px-2.5 flex items-center text-xs text-muted-foreground">
              Input field
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-success bg-success/15 px-2 py-0.5 rounded-full">
                ✓ Success
              </span>
              <span className="text-[10px] font-semibold text-warning bg-warning/15 px-2 py-0.5 rounded-full">
                ⚠ Warning
              </span>
              <span className="text-[10px] font-semibold text-destructive bg-destructive/15 px-2 py-0.5 rounded-full">
                ✕ Error
              </span>
              <span className="text-[10px] font-semibold text-info bg-info/15 px-2 py-0.5 rounded-full">
                ℹ Info
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetAll}
          disabled={saving}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 self-start"
        >
          <RotateCcw className="size-3.5" />
          <span>Reset everything</span>
        </Button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={saving} className="text-xs gap-1.5">
              <Undo2 className="size-3.5" />
              <span>Discard</span>
            </Button>
          )}
          {canManageDefault && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || !dirty}
              onClick={() => saveDefault.mutate(buildSaveTarget())}
              className="text-xs gap-1.5"
            >
              {saveDefault.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>Save as workspace default</span>
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving || !dirty}
            onClick={() => saveMine.mutate(buildSaveTarget())}
            className="text-xs font-semibold px-5 gap-1.5"
          >
            {saveMine.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            <span>{canManageDefault ? 'Save for me' : 'Save changes'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One colour token: swatch + validated hex field, with reset when overridden. */
function ColorFieldItem({
  label,
  token,
  value,
  overridden,
  onChange,
  onReset,
}: {
  label: string;
  token: string;
  value: string;
  overridden: boolean;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-border bg-surface-raised">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold truncate flex items-center gap-1.5">
          {label}
          {overridden && <span className="size-1.5 rounded-full bg-primary shrink-0" title="Customized" />}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground font-mono">{token}</span>
          <button
            type="button"
            onClick={onReset}
            disabled={!overridden}
            aria-label={`Reset ${label}`}
            title="Reset to generated default"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <RotateCcw className="size-2.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="relative size-7 rounded-lg cursor-pointer shrink-0 border border-black/20 shadow-xs overflow-hidden"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            tabIndex={-1}
            aria-label={`Pick ${label} color`}
            value={isValidHexColor(value) ? value : '#808080'}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
          />
        </div>
        <HexInput value={value} onCommit={onChange} aria-label={`${label} hex`} className="h-8 text-xs font-mono" />
      </div>
    </div>
  );
}
