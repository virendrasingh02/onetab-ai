import {
  DENSITIES,
  RADII,
  THEME_PRESETS,
  useTheme,
  type Density,
  type RadiusPreset,
  type ThemePreset,
} from '@org/design-system';
import {
  toast,
  AppSelect,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ThemeCustomizer } from './theme-customizer.js';

/** Pill toggle shared by the color-mode and custom/presets switches. */
function PillToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="gap-1 p-1 flex items-center rounded-lg border border-border bg-surface-inset"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'gap-1.5 px-2.5 py-1 flex items-center rounded-md text-xs font-medium transition-colors cursor-pointer [&_svg]:size-3.5',
              active
                ? 'bg-background font-semibold text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeSettings() {
  const {
    theme,
    density,
    radius,
    customTheme,
    setTheme,
    setDensity,
    setRadius,
    setCustomTheme,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('custom');

  const handleSelectPreset = (preset: ThemePreset) => {
    if (preset.id === 'default') {
      setCustomTheme(null);
      toast.success(`Applied ${preset.name}`);
      return;
    }

    // Preserve the user's current Color Mode; the preset only sets brand hues.
    setCustomTheme({ ...preset.config, mode: theme });
    toast.success(`Applied ${preset.name}`);
  };

  return (
    <>
      <SettingsGroup
        title="Color mode"
        description={
          <>
            Applies to <span className="font-semibold">you</span> in this
            workspace only. A workspace admin sets the shared default under
            Workspace Settings ▸ Appearance &amp; Branding.
          </>
        }
      >
        <SettingsCard divided>
          <SettingsRow
            title="Interface mode"
            description="Choose between light, dark, or automatic system sync"
          >
            <PillToggle
              label="Interface mode"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light', icon: <Sun className="text-warning-text" /> },
                { value: 'dark', label: 'Dark', icon: <Moon className="text-info-text" /> },
                { value: 'system', label: 'System', icon: <Monitor /> },
              ]}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Theme"
        action={
          <PillToggle
            label="Theme source"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'custom', label: 'Custom theme' },
              { value: 'presets', label: 'Curated presets' },
            ]}
          />
        }
      >
        {activeTab === 'custom' ? (
          <ThemeCustomizer />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEME_PRESETS.map((preset) => {
              const isSelected =
                (preset.id === 'default' && (!customTheme || customTheme.type === 'default')) ||
                customTheme?.presetId === preset.id;

              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 bg-surface hover:border-border-strong ${
                    isSelected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{preset.name}</h4>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Check className="size-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>

                  {/* Swatch chips */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {preset.previewColors.map((color, idx) => (
                      <span
                        key={idx}
                        className="size-5 rounded-full border border-black/20 shadow-2xs shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                      light + dark
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title="Density & geometry">
        <SettingsCard divided>
          <SettingsRow
            title="Control density"
            description="Adjust the spacing, padding, and height of buttons and inputs"
          >
            <AppSelect
              value={density}
              onValueChange={(v) => setDensity(v as Density)}
              options={DENSITIES.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
              className="w-36"
              aria-label="Control density"
            />
          </SettingsRow>

          <SettingsRow
            title="Corner radius"
            description="Customize the rounded curve on cards, popups, and buttons"
          >
            <AppSelect
              value={radius}
              onValueChange={(v) => setRadius(v as RadiusPreset)}
              options={RADII.map((r) => ({ value: r, label: r.toUpperCase() }))}
              className="w-36"
              aria-label="Corner radius"
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>
    </>
  );
}
