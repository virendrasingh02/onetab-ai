import {
  checkContrast,
  downloadThemeConfigFile,
  isValidHexColor,
  THEME_PRESETS,
  type ThemePreset,
  useTheme,
  validateAndParseThemeConfig,
} from '@org/design-system';
import type { GradientConfig, ThemeConfig } from '@org/types';
import { Button, Input, toast } from '@org/ui';
import {
  Check,
  Download,
  Eye,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { GradientEditor } from './gradient-editor.js';

export interface ThemeCustomizerProps {
  onSaved?: () => void;
  className?: string;
}

export function ThemeCustomizer({ onSaved, className = '' }: ThemeCustomizerProps) {
  const {
    resolvedTheme,
    customTheme,
    setCustomTheme,
    setDraftTheme,
    resetTheme,
  } = useTheme();

  // Active section tab: Presets | Flat Colors | Gradients
  const [activeTab, setActiveTab] = useState<'flat' | 'gradients' | 'presets'>('flat');

  // Working state copy of ThemeConfig
  const [themeState, setThemeState] = useState<ThemeConfig>(() => {
    if (customTheme) return { ...customTheme };
    return {
      mode: resolvedTheme === 'dark' ? 'dark' : 'light',
      type: 'custom',
      brandColor: resolvedTheme === 'dark' ? '#60c686' : '#037152',
      neutralColor: resolvedTheme === 'dark' ? '#0a0a0a' : '#fcfbf8',
      colors: {
        primary: resolvedTheme === 'dark' ? '#60c686' : '#037152',
        secondary: resolvedTheme === 'dark' ? '#071812' : '#f5f5f5',
        accent: resolvedTheme === 'dark' ? '#262626' : '#f1f0ec',
        background: resolvedTheme === 'dark' ? '#0a0a0a' : '#fcfbf8',
        foreground: resolvedTheme === 'dark' ? '#ffffff' : '#09090b',
        card: resolvedTheme === 'dark' ? '#171717' : '#ffffff',
        muted: resolvedTheme === 'dark' ? '#1f1f1f' : '#f4f4f5',
        border: resolvedTheme === 'dark' ? '#2e2e2e' : '#eeece6',
        input: resolvedTheme === 'dark' ? '#262626' : '#f4f4f5',
        ring: resolvedTheme === 'dark' ? '#60c686' : '#037152',
        success: '#10b981',
        warning: '#f59e0b',
        destructive: '#ef4444',
        info: '#3b82f6',
      },
      gradients: {
        primary: {
          type: 'linear',
          angle: 135,
          stops: [
            { color: '#60c686', position: 0 },
            { color: '#37b06f', position: 100 },
          ],
        },
        accent: {
          type: 'linear',
          angle: 135,
          stops: [
            { color: '#3b82f6', position: 0 },
            { color: '#8b5cf6', position: 100 },
          ],
        },
        background: {
          type: 'linear',
          angle: 180,
          stops: [
            { color: '#0a0a0a', position: 0 },
            { color: '#171717', position: 100 },
          ],
        },
        hero: {
          type: 'linear',
          angle: 135,
          stops: [
            { color: '#60c686', position: 0 },
            { color: '#06b6d4', position: 100 },
          ],
        },
        button: {
          type: 'linear',
          angle: 135,
          stops: [
            { color: '#60c686', position: 0 },
            { color: '#37b06f', position: 100 },
          ],
        },
      },
    };
  });

  const [hasChanges, setHasChanges] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft live to document variables on any change
  useEffect(() => {
    setDraftTheme(themeState);
    setHasChanges(true);
  }, [themeState, setDraftTheme]);

  // Clean up draft on unmount if not committed
  useEffect(() => {
    return () => {
      setDraftTheme(null);
    };
  }, [setDraftTheme]);

  const updateColor = (key: string, value: string) => {
    setThemeState((prev) => ({
      ...prev,
      type: 'custom',
      presetId: undefined,
      brandColor: key === 'primary' ? value : prev.brandColor,
      neutralColor: key === 'background' ? value : prev.neutralColor,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const resetSingleColor = (key: string, fallback: string) => {
    updateColor(key, fallback);
    toast.success(`Reset ${key} color`);
  };

  const updateGradient = (slot: string, grad: GradientConfig) => {
    setThemeState((prev) => ({
      ...prev,
      type: 'custom',
      presetId: undefined,
      gradients: {
        ...prev.gradients,
        [slot]: grad,
      },
    }));
  };

  const resetSingleGradient = (slot: string) => {
    setThemeState((prev) => {
      const nextGradients = { ...prev.gradients };
      delete nextGradients[slot as keyof typeof nextGradients];
      return {
        ...prev,
        gradients: nextGradients,
      };
    });
    toast.success(`Reset ${slot} gradient`);
  };

  const handleApplyPreset = (preset: ThemePreset) => {
    // Keep whatever Color Mode the user is on — a preset is a brand identity,
    // not a light/dark choice. Surfaces are synthesized for the active mode.
    setThemeState((prev) => ({ ...preset.config, mode: prev.mode }));
    toast.success(`Applied ${preset.name} preset`);
  };

  const handleModeChange = (mode: 'light' | 'dark') => {
    setThemeState((prev) => ({
      ...prev,
      mode,
    }));
  };

  const handleSaveTheme = () => {
    setCustomTheme(themeState);
    setHasChanges(false);
    toast.success('Theme colors and gradients saved successfully!');
    onSaved?.();
  };

  const handleResetColors = () => {
    const isDark = themeState.mode === 'dark';
    setThemeState((prev) => ({
      ...prev,
      brandColor: isDark ? '#60c686' : '#037152',
      neutralColor: isDark ? '#0a0a0a' : '#fcfbf8',
      colors: {
        primary: isDark ? '#60c686' : '#037152',
        secondary: isDark ? '#071812' : '#f5f5f5',
        accent: isDark ? '#262626' : '#f1f0ec',
        background: isDark ? '#0a0a0a' : '#fcfbf8',
        foreground: isDark ? '#ffffff' : '#09090b',
        card: isDark ? '#171717' : '#ffffff',
        muted: isDark ? '#1f1f1f' : '#f4f4f5',
        border: isDark ? '#2e2e2e' : '#eeece6',
        input: isDark ? '#262626' : '#f4f4f5',
        ring: isDark ? '#60c686' : '#037152',
        success: '#10b981',
        warning: '#f59e0b',
        destructive: '#ef4444',
        info: '#3b82f6',
      },
    }));
    toast.success('Flat colors reset to defaults.');
  };

  const handleResetGradients = () => {
    setThemeState((prev) => ({
      ...prev,
      gradients: {
        primary: {
          type: 'linear',
          angle: 135,
          stops: [
            { color: '#60c686', position: 0 },
            { color: '#37b06f', position: 100 },
          ],
        },
      },
    }));
    toast.success('Gradients reset to defaults.');
  };

  const handleResetAll = () => {
    resetTheme();
    setThemeState({
      mode: 'dark',
      type: 'default',
      brandColor: '#60c686',
      neutralColor: '#0a0a0a',
    });
    setHasChanges(false);
    toast.success('All colors & gradients reset to platform default.');
  };

  const handleDownloadConfig = () => {
    downloadThemeConfigFile(themeState, 'platform-color-theme.json');
    toast.success('Exported platform-color-theme.json');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateAndParseThemeConfig(content);
      if (result.success && result.config) {
        setThemeState(result.config);
        toast.success('Color configuration imported! Click "Save Changes" to commit.');
      } else {
        toast.error(result.error || 'Failed to import theme configuration.');
      }
    };
    reader.onerror = () => {
      toast.error('Could not read uploaded JSON file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // WCAG Contrast Checks
  const primaryColor = themeState.colors?.primary || themeState.brandColor || '#60c686';
  const bgColor = themeState.colors?.background || themeState.neutralColor || '#0a0a0a';
  const fgColor = themeState.colors?.foreground || (themeState.mode === 'dark' ? '#ffffff' : '#09090b');
  const contrastCheckButton = checkContrast('#ffffff', primaryColor);
  const contrastCheckBody = checkContrast(fgColor, bgColor);

  return (
    <div className={`rounded-2xl border border-border bg-surface text-foreground shadow-xs p-5 sm:p-6 space-y-6 ${className}`}>
      {/* ---------------- TOP HEADER BAR ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span>Platform Color &amp; Gradient Customizer</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centralized management for platform flat colors, gradients, and theme tokens with real-time live preview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => importInputRef.current?.click()}
            className="text-xs gap-1.5 border-border bg-surface hover:bg-accent cursor-pointer"
          >
            <Upload className="size-3.5" />
            <span>Import JSON</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleDownloadConfig}
            className="text-xs gap-1.5 border-border bg-surface hover:bg-accent cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export JSON</span>
          </Button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* ---------------- PRESET THEMES SWATCH BAR ---------------- */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Predefined Color Themes</span>
          </span>
          <span className="text-[11px] text-muted-foreground">Select a preset to update all semantic tokens</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {THEME_PRESETS.map((preset) => {
            const isActive =
              (preset.id === 'default' && (!themeState.presetId || themeState.type === 'default')) ||
              themeState.presetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/10 shadow-xs'
                    : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised'
                }`}
                title={preset.description}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-foreground truncate">{preset.name}</span>
                  {isActive && <Check className="size-3 text-primary shrink-0" />}
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

      {/* ---------------- SECTION TABS ---------------- */}
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('flat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'flat'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
          }`}
        >
          <Palette className="size-3.5" />
          <span>Flat Colors</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gradients')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'gradients'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>Gradients</span>
        </button>

        {/* Mode Switcher */}
        <div className="ml-auto flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => handleModeChange('light')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
              themeState.mode === 'light'
                ? 'bg-background text-foreground shadow-2xs font-bold'
                : 'text-muted-foreground'
            }`}
          >
            <Sun className="size-3 text-warning-text" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('dark')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
              themeState.mode === 'dark'
                ? 'bg-background text-foreground shadow-2xs font-bold'
                : 'text-muted-foreground'
            }`}
          >
            <Moon className="size-3 text-info-text" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* ---------------- FLAT COLORS SECTION ---------------- */}
      {activeTab === 'flat' && (
        <div className="space-y-6">
          {/* Brand & Canvas Group */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Brand &amp; Canvas Palette
              </h4>
              <button
                type="button"
                onClick={handleResetColors}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="size-3" />
                <span>Reset Flat Colors</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Primary */}
              <ColorFieldItem
                label="Primary Brand"
                token="--color-primary"
                value={primaryColor}
                fallback={themeState.mode === 'dark' ? '#60c686' : '#037152'}
                onChange={(val) => updateColor('primary', val)}
                onReset={(fb) => resetSingleColor('primary', fb)}
              />

              {/* Secondary */}
              <ColorFieldItem
                label="Secondary Surface"
                token="--color-secondary"
                value={themeState.colors?.secondary || (themeState.mode === 'dark' ? '#071812' : '#f5f5f5')}
                fallback={themeState.mode === 'dark' ? '#071812' : '#f5f5f5'}
                onChange={(val) => updateColor('secondary', val)}
                onReset={(fb) => resetSingleColor('secondary', fb)}
              />

              {/* Accent */}
              <ColorFieldItem
                label="Accent &amp; Hover"
                token="--color-accent"
                value={themeState.colors?.accent || (themeState.mode === 'dark' ? '#262626' : '#f1f0ec')}
                fallback={themeState.mode === 'dark' ? '#262626' : '#f1f0ec'}
                onChange={(val) => updateColor('accent', val)}
                onReset={(fb) => resetSingleColor('accent', fb)}
              />

              {/* Background */}
              <ColorFieldItem
                label="Background Canvas"
                token="--color-background"
                value={bgColor}
                fallback={themeState.mode === 'dark' ? '#0a0a0a' : '#fcfbf8'}
                onChange={(val) => updateColor('background', val)}
                onReset={(fb) => resetSingleColor('background', fb)}
              />

              {/* Foreground / Text */}
              <ColorFieldItem
                label="Text / Foreground"
                token="--color-foreground"
                value={fgColor}
                fallback={themeState.mode === 'dark' ? '#ffffff' : '#09090b'}
                onChange={(val) => updateColor('foreground', val)}
                onReset={(fb) => resetSingleColor('foreground', fb)}
              />

              {/* Focus Ring */}
              <ColorFieldItem
                label="Focus Ring"
                token="--color-ring"
                value={themeState.colors?.ring || primaryColor}
                fallback={primaryColor}
                onChange={(val) => updateColor('ring', val)}
                onReset={(fb) => resetSingleColor('ring', fb)}
              />
            </div>
          </div>

          {/* Surfaces & Borders Group */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Surfaces, Muted &amp; Borders
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Card */}
              <ColorFieldItem
                label="Card &amp; Panel Surface"
                token="--color-card"
                value={themeState.colors?.card || (themeState.mode === 'dark' ? '#171717' : '#ffffff')}
                fallback={themeState.mode === 'dark' ? '#171717' : '#ffffff'}
                onChange={(val) => updateColor('card', val)}
                onReset={(fb) => resetSingleColor('card', fb)}
              />

              {/* Muted */}
              <ColorFieldItem
                label="Muted Elements"
                token="--color-muted"
                value={themeState.colors?.muted || (themeState.mode === 'dark' ? '#1f1f1f' : '#f4f4f5')}
                fallback={themeState.mode === 'dark' ? '#1f1f1f' : '#f4f4f5'}
                onChange={(val) => updateColor('muted', val)}
                onReset={(fb) => resetSingleColor('muted', fb)}
              />

              {/* Border */}
              <ColorFieldItem
                label="Border Hairline"
                token="--color-border"
                value={themeState.colors?.border || (themeState.mode === 'dark' ? '#2e2e2e' : '#eeece6')}
                fallback={themeState.mode === 'dark' ? '#2e2e2e' : '#eeece6'}
                onChange={(val) => updateColor('border', val)}
                onReset={(fb) => resetSingleColor('border', fb)}
              />

              {/* Input */}
              <ColorFieldItem
                label="Input Background"
                token="--color-input"
                value={themeState.colors?.input || (themeState.mode === 'dark' ? '#262626' : '#f4f4f5')}
                fallback={themeState.mode === 'dark' ? '#262626' : '#f4f4f5'}
                onChange={(val) => updateColor('input', val)}
                onReset={(fb) => resetSingleColor('input', fb)}
              />
            </div>
          </div>

          {/* Status Colors Group */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Status &amp; Notification Colors
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Success */}
              <ColorFieldItem
                label="Success"
                token="--color-success"
                value={themeState.colors?.success || '#10b981'}
                fallback="#10b981"
                onChange={(val) => updateColor('success', val)}
                onReset={(fb) => resetSingleColor('success', fb)}
              />

              {/* Warning */}
              <ColorFieldItem
                label="Warning"
                token="--color-warning"
                value={themeState.colors?.warning || '#f59e0b'}
                fallback="#f59e0b"
                onChange={(val) => updateColor('warning', val)}
                onReset={(fb) => resetSingleColor('warning', fb)}
              />

              {/* Destructive / Error */}
              <ColorFieldItem
                label="Destructive / Error"
                token="--color-destructive"
                value={themeState.colors?.destructive || '#ef4444'}
                fallback="#ef4444"
                onChange={(val) => updateColor('destructive', val)}
                onReset={(fb) => resetSingleColor('destructive', fb)}
              />

              {/* Info */}
              <ColorFieldItem
                label="Info"
                token="--color-info"
                value={themeState.colors?.info || '#3b82f6'}
                fallback="#3b82f6"
                onChange={(val) => updateColor('info', val)}
                onReset={(fb) => resetSingleColor('info', fb)}
              />
            </div>
          </div>

          {/* WCAG Contrast Health Check Badge */}
          <div className="p-3.5 rounded-xl border border-border bg-surface-raised flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground flex items-center gap-2">
                <span>Accessibility &amp; Contrast Evaluation</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    contrastCheckButton.passesAA ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                  }`}
                >
                  {contrastCheckButton.level} Compliance
                </span>
              </span>
              <p className="text-[11px] text-muted-foreground">
                Primary Button Label Contrast: <strong className="text-foreground">{contrastCheckButton.formattedRatio}</strong> | Body Text on Canvas: <strong className="text-foreground">{contrastCheckBody.formattedRatio}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- GRADIENTS SECTION ---------------- */}
      {activeTab === 'gradients' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Platform Gradients
            </h4>
            <button
              type="button"
              onClick={handleResetGradients}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset Gradients</span>
            </button>
          </div>

          <GradientEditor
            label="Primary Gradient (--gradient-primary)"
            value={themeState.gradients?.primary}
            onChange={(grad) => updateGradient('primary', grad)}
            onReset={() => resetSingleGradient('primary')}
          />

          <GradientEditor
            label="Accent Gradient (--gradient-accent)"
            value={themeState.gradients?.accent}
            onChange={(grad) => updateGradient('accent', grad)}
            onReset={() => resetSingleGradient('accent')}
          />

          <GradientEditor
            label="Background Gradient (--gradient-background)"
            value={themeState.gradients?.background}
            onChange={(grad) => updateGradient('background', grad)}
            onReset={() => resetSingleGradient('background')}
          />

          <GradientEditor
            label="Hero Gradient (--gradient-hero)"
            value={themeState.gradients?.hero}
            onChange={(grad) => updateGradient('hero', grad)}
            onReset={() => resetSingleGradient('hero')}
          />

          <GradientEditor
            label="Button Gradient (--gradient-button)"
            value={themeState.gradients?.button}
            onChange={(grad) => updateGradient('button', grad)}
            onReset={() => resetSingleGradient('button')}
          />
        </div>
      )}

      {/* ---------------- LIVE INTERACTIVE PREVIEW SHOWCASE ---------------- */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface-raised space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Eye className="size-3.5 text-primary" />
            <span>Live Interactive Preview</span>
          </span>
          <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
            {hasChanges ? 'Live Preview Active' : 'Saved Theme'}
          </span>
        </div>

        {/* Live Mock UI Components Test Bench */}
        <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs"
                style={{ background: 'var(--gradient-primary, var(--primary))', color: 'var(--primary-foreground, #ffffff)' }}
              >
                AI
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">OneTab Color Engine</h4>
                <p className="text-[11px] text-muted-foreground">Tokens live rendering</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" className="text-xs">
                Outline
              </Button>
              <Button size="xs" variant="primary" className="text-xs shadow-xs">
                Primary Button
              </Button>
              <Button
                size="xs"
                className="text-xs shadow-xs text-primary-foreground border-0"
                style={{ background: 'var(--gradient-button, var(--gradient-primary, var(--primary)))' }}
              >
                Gradient Button
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
            <Input placeholder="Type to test focus ring..." className="h-8 text-xs" />
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

      {/* ---------------- BOTTOM ACTION BAR ---------------- */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetAll}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset All Colors</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetColors}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          >
            <span>Reset Flat</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetGradients}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          >
            <span>Reset Gradients</span>
          </Button>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveTheme}
            className="text-xs font-semibold px-5 shadow-sm gap-1.5 cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Individual color swatch & text input component with reset capability. */
function ColorFieldItem({
  label,
  token,
  value,
  fallback,
  onChange,
  onReset,
}: {
  label: string;
  token: string;
  value: string;
  fallback: string;
  onChange: (val: string) => void;
  onReset?: (fallback: string) => void;
}) {
  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-border bg-surface-raised">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono">{token}</span>
          {onReset && (
            <button
              type="button"
              onClick={() => onReset(fallback)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Reset color"
            >
              <RotateCcw className="size-2.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="relative size-7 rounded-lg cursor-pointer shrink-0 border border-black/20 shadow-xs overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            tabIndex={-1}
            aria-label={`Pick ${label} color`}
            value={isValidHexColor(value) ? value : fallback}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>
    </div>
  );
}
