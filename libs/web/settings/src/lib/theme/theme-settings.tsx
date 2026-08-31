import {
  DENSITIES,
  RADII,
  THEME_PRESETS,
  useTheme,
  type Density,
  type RadiusPreset,
  type ThemePreset,
} from '@org/design-system';
import { toast } from '@org/ui';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { ThemeCustomizer } from './theme-customizer.js';

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
    <div className="space-y-8 text-foreground">
      {/* Header Section */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Theme &amp; Appearance</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Select or customize your interface color scheme, presets, and control density.
        </p>
      </div>

      {/* ---------------- SECTION 1: COLOR MODE SELECTOR ---------------- */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Color Mode
        </h3>
        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Interface Mode</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Choose between light, dark, or automatic system sync
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="size-3.5 text-warning-text" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="size-3.5 text-info-text" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="size-3.5 text-muted-foreground" />
                <span>System</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- SECTION 2: THEME PRESETS VS CUSTOM EDITOR ---------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Theme Customization &amp; Presets
          </h3>

          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Custom Theme
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Curated Presets
            </button>
          </div>
        </div>

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
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 bg-surface hover:border-border-strong ${
                    isSelected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">{preset.name}</h4>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Check className="size-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
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
      </div>

      {/* ---------------- SECTION 3: INTERFACE DENSITY & RADIUS ---------------- */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Density &amp; Geometry
        </h3>
        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Control Density</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Adjust the spacing, padding, and height of buttons and inputs
              </p>
            </div>
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
              className="h-8 rounded-lg border border-border bg-surface px-3 text-xs text-foreground outline-none"
            >
              {DENSITIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Corner Radius</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Customize the rounded curve on cards, popups, and buttons
              </p>
            </div>
            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value as RadiusPreset)}
              className="h-8 rounded-lg border border-border bg-surface px-3 text-xs text-foreground outline-none"
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
    </div>
  );
}
