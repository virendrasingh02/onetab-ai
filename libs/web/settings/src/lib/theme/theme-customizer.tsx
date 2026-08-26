import {
  downloadThemeConfigFile,
  isValidHexColor,
  useTheme,
  validateAndParseThemeConfig,
} from '@org/design-system';
import type { ThemeConfig } from '@org/types';
import { Button, Input, toast } from '@org/ui';
import {
  Check,
  Download,
  Moon,
  Paintbrush,
  Pipette,
  RotateCcw,
  Sun,
  Upload,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface ThemeCustomizerProps {
  onSaved?: () => void;
  className?: string;
}

export function ThemeCustomizer({ onSaved, className = '' }: ThemeCustomizerProps) {
  const {
    theme,
    resolvedTheme,
    customTheme,
    setCustomTheme,
    setDraftTheme,
    resetTheme,
  } = useTheme();

  // Local editor draft state
  const initialMode = customTheme?.mode || (resolvedTheme === 'dark' ? 'dark' : 'light');
  const initialBrand = customTheme?.brandColor || (resolvedTheme === 'dark' ? '#60c686' : '#037152');
  const initialNeutral = customTheme?.neutralColor || (resolvedTheme === 'dark' ? '#0a0a0a' : '#fcfbf8');

  const [mode, setMode] = useState<'light' | 'dark'>(initialMode === 'light' ? 'light' : 'dark');
  const [brandColor, setBrandColor] = useState(initialBrand);
  const [neutralColor, setNeutralColor] = useState(initialNeutral);
  const [hasChanges, setHasChanges] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Apply live draft preview whenever editor values change
  useEffect(() => {
    if (isValidHexColor(brandColor) && isValidHexColor(neutralColor)) {
      const draft: ThemeConfig = {
        mode,
        type: 'custom',
        brandColor,
        neutralColor,
      };
      setDraftTheme(draft);
      setHasChanges(true);
    }
  }, [mode, brandColor, neutralColor, setDraftTheme]);

  // Clean up draft on unmount if not saved
  useEffect(() => {
    return () => {
      setDraftTheme(null);
    };
  }, [setDraftTheme]);

  const handleSaveTheme = () => {
    if (!isValidHexColor(brandColor) || !isValidHexColor(neutralColor)) {
      toast.error('Please enter valid hex color codes (e.g., #ec15e7).');
      return;
    }

    const config: ThemeConfig = {
      mode,
      type: 'custom',
      brandColor,
      neutralColor,
    };

    setCustomTheme(config);
    setHasChanges(false);
    toast.success('Custom theme applied and saved!');
    onSaved?.();
  };

  const handleResetToDefault = () => {
    resetTheme();
    setMode('dark');
    setBrandColor('#60c686');
    setNeutralColor('#0a0a0a');
    setHasChanges(false);
    toast.success('Theme reset to default.');
  };

  const handleDownloadConfig = () => {
    const config: ThemeConfig = {
      mode,
      type: 'custom',
      brandColor,
      neutralColor,
    };
    downloadThemeConfigFile(config, 'platform-theme-config.json');
    toast.success('Downloaded platform-theme-config.json');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateAndParseThemeConfig(content);
      if (result.success && result.config) {
        const imported = result.config;
        setMode(imported.mode === 'light' ? 'light' : 'dark');
        if (imported.brandColor) setBrandColor(imported.brandColor);
        if (imported.neutralColor) setNeutralColor(imported.neutralColor);
        toast.success('Theme config imported successfully! Click "Set theme" to persist.');
      } else {
        toast.error(result.error || 'Failed to import theme configuration.');
      }
    };
    reader.onerror = () => {
      toast.error('Could not read the uploaded JSON file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-surface text-foreground shadow-xs p-5 sm:p-6 space-y-6 ${className}`}
    >
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Paintbrush className="size-4 text-primary" />
            <span>Customize your theme</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure custom brand accents and neutral surface colors with live preview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => importInputRef.current?.click()}
            className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
          >
            <Upload className="size-3.5" />
            <span>Import config</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleDownloadConfig}
            className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
          >
            <Download className="size-3.5" />
            <span>Download config</span>
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

      {/* Editor Controls Grid */}
      <div className="space-y-5">
        {/* Step 1: Color Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Choose color mode</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('light')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                mode === 'light'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="size-4 text-amber-500" />
              <span>Light mode</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('dark')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                mode === 'dark'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="size-4 text-indigo-400" />
              <span>Dark mode</span>
            </button>
          </div>
        </div>

        {/* Step 2: Color Pickers Row (Neutral & Brand) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Neutral Color Input & Swatch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Neutral color</label>
              <span className="text-[11px] text-muted-foreground">Background &amp; Surfaces</span>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl border border-border bg-surface-raised">
              {/* Native Color Picker Trigger Pill */}
              <label
                className="relative size-7 rounded-lg cursor-pointer shrink-0 border border-black/20 shadow-xs overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: isValidHexColor(neutralColor) ? neutralColor : '#0a0a0a' }}
              >
                <input
                  type="color"
                  value={isValidHexColor(neutralColor) ? neutralColor : '#0a0a0a'}
                  onChange={(e) => setNeutralColor(e.target.value)}
                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                />
              </label>

              {/* Hex Input */}
              <div className="relative flex-1">
                <Input
                  value={neutralColor}
                  onChange={(e) => setNeutralColor(e.target.value)}
                  placeholder="#5a007a"
                  className="h-8 text-xs font-mono pl-2"
                />
              </div>

              {/* Preset quick chip */}
              <button
                type="button"
                onClick={() => setNeutralColor(mode === 'dark' ? '#0a0a0a' : '#fcfbf8')}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/80 bg-surface"
              >
                Default
              </button>
            </div>
          </div>

          {/* Brand Color Input & Swatch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Brand color</label>
              <span className="text-[11px] text-muted-foreground">Primary &amp; Interactive Accents</span>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl border border-border bg-surface-raised">
              {/* Native Color Picker Trigger Pill */}
              <label
                className="relative size-7 rounded-lg cursor-pointer shrink-0 border border-black/20 shadow-xs overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: isValidHexColor(brandColor) ? brandColor : '#60c686' }}
              >
                <input
                  type="color"
                  value={isValidHexColor(brandColor) ? brandColor : '#60c686'}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                />
              </label>

              {/* Hex Input */}
              <div className="relative flex-1">
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#ec15e7"
                  className="h-8 text-xs font-mono pl-2"
                />
              </div>

              {/* Preset quick chip */}
              <button
                type="button"
                onClick={() => setBrandColor('#60c686')}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/80 bg-surface"
              >
                Default
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 rounded-xl border border-border/80 bg-surface-raised space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Live Theme Preview</span>
            <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-wider">
              {hasChanges ? 'Draft Preview Active' : 'Saved Theme'}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
                AI
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Primary Accent Test</h4>
                <p className="text-[11px] text-muted-foreground">Interactive button, focus ring and links</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" className="text-xs">
                Secondary
              </Button>
              <Button size="xs" variant="primary" className="text-xs">
                Action Button
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResetToDefault}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="size-3.5" />
          <span>Reset to default</span>
        </Button>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveTheme}
            className="text-xs font-semibold px-5 shadow-sm gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Set theme</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
