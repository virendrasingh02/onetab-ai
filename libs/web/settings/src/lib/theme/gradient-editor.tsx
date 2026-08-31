import {
  formatColorWithOpacity,
  generateCssGradient,
  GRADIENT_PRESETS,
  type GradientPreset,
} from '@org/design-system';
import type { GradientConfig, GradientStop } from '@org/types';
import { Button, Input } from '@org/ui';
import { Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface GradientEditorProps {
  value?: GradientConfig | string;
  onChange: (next: GradientConfig) => void;
  onReset?: () => void;
  label?: string;
  className?: string;
}

export function GradientEditor({
  value,
  onChange,
  onReset,
  label = 'Gradient',
  className = '',
}: GradientEditorProps) {
  // Normalize initial value to GradientConfig
  const initialConfig: GradientConfig =
    typeof value === 'object' && value !== null
      ? value
      : {
          type: 'linear',
          angle: 135,
          stops: [
            { color: typeof value === 'string' && value.startsWith('#') ? value : '#60c686', position: 0 },
            { color: '#3b82f6', position: 100 },
          ],
        };

  const [activeStopIndex, setActiveStopIndex] = useState(0);

  const currentGradient = initialConfig;
  const stops = currentGradient.stops || [
    { color: '#60c686', position: 0 },
    { color: '#3b82f6', position: 100 },
  ];
  const activeStop = stops[activeStopIndex] || stops[0];

  const handleTypeChange = (type: 'linear' | 'radial') => {
    onChange({
      ...currentGradient,
      type,
    });
  };

  const handleAngleChange = (angle: number) => {
    onChange({
      ...currentGradient,
      angle,
    });
  };

  const handleAddStop = () => {
    const lastStop = stops[stops.length - 1];
    const prevStop = stops[stops.length - 2] || stops[0];
    const newPos = Math.min(100, Math.round((lastStop.position + prevStop.position) / 2));
    const newStop: GradientStop = {
      color: '#a855f7',
      position: newPos,
    };
    const nextStops = [...stops, newStop].sort((a, b) => a.position - b.position);
    const newIndex = nextStops.indexOf(newStop);
    onChange({
      ...currentGradient,
      stops: nextStops,
    });
    setActiveStopIndex(newIndex >= 0 ? newIndex : 0);
  };

  const handleRemoveStop = (idx: number) => {
    if (stops.length <= 2) return; // Keep at least 2 stops
    const nextStops = stops.filter((_, i) => i !== idx);
    onChange({
      ...currentGradient,
      stops: nextStops,
    });
    setActiveStopIndex(Math.max(0, idx - 1));
  };

  const handleUpdateStopColor = (color: string) => {
    const nextStops = stops.map((s, i) => (i === activeStopIndex ? { ...s, color } : s));
    onChange({
      ...currentGradient,
      stops: nextStops,
    });
  };

  const handleUpdateStopPosition = (position: number) => {
    const nextStops = stops
      .map((s, i) => (i === activeStopIndex ? { ...s, position } : s))
      .sort((a, b) => a.position - b.position);
    onChange({
      ...currentGradient,
      stops: nextStops,
    });
  };

  const handleApplyPreset = (preset: GradientPreset) => {
    onChange(preset.config);
    setActiveStopIndex(0);
  };

  const previewCss = generateCssGradient(currentGradient);

  return (
    <div className={`p-4 rounded-xl border border-border bg-surface-raised space-y-4 ${className}`}>
      {/* Header & Type selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          )}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border/80 text-[11px]">
            <button
              type="button"
              onClick={() => handleTypeChange('linear')}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                currentGradient.type === 'linear' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              Linear
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('radial')}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                currentGradient.type === 'radial' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              Radial
            </button>
          </div>
        </div>
      </div>

      {/* Visual Gradient Bar with interactive stops */}
      <div className="space-y-2">
        <div
          className="h-10 w-full rounded-lg border border-black/15 shadow-inner relative select-none"
          style={{ background: previewCss }}
        />

        {/* Color Stops Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {stops.map((stop, idx) => {
              const isSelected = idx === activeStopIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveStopIndex(idx)}
                  className={`size-7 rounded-lg border flex items-center justify-center p-0.5 transition-all cursor-pointer ${
                    isSelected ? 'border-primary ring-2 ring-primary/40 scale-110 shadow-xs' : 'border-border/80'
                  }`}
                  title={`Stop ${idx + 1}: ${stop.color} (${stop.position}%)`}
                >
                  <span
                    className="w-full h-full rounded-[4px] border border-black/20"
                    style={{ backgroundColor: formatColorWithOpacity(stop.color, stop.opacity) }}
                  />
                </button>
              );
            })}

            {stops.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddStop}
                className="size-7 p-0 rounded-lg border-dashed border-border cursor-pointer"
                title="Add color stop"
              >
                <Plus className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>

          {stops.length > 2 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => handleRemoveStop(activeStopIndex)}
              className="text-destructive hover:text-destructive h-7 text-[11px] gap-1 px-2 cursor-pointer"
            >
              <Trash2 className="size-3" />
              <span>Remove stop</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Stop Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
        {/* Color picker & hex */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Stop {activeStopIndex + 1} Color
          </span>
          <div className="flex items-center gap-2">
            <div
              className="relative size-7 rounded-lg cursor-pointer shrink-0 border border-black/20 shadow-xs overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: activeStop.color }}
            >
              <input
                type="color"
                tabIndex={-1}
                aria-label={`Pick color for stop ${activeStopIndex + 1}`}
                value={activeStop.color}
                onChange={(e) => handleUpdateStopColor(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
            </div>
            <Input
              value={activeStop.color}
              onChange={(e) => handleUpdateStopColor(e.target.value)}
              className="h-7 text-xs font-mono"
            />
          </div>
        </div>

        {/* Stop position slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Stop Position</span>
            <span className="font-mono">{activeStop.position}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={activeStop.position}
            onChange={(e) => handleUpdateStopPosition(Number(e.target.value))}
            className="w-full accent-primary h-1.5 bg-border rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Angle Slider (for linear gradients) */}
      {currentGradient.type === 'linear' && (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <RotateCw className="size-3" />
              <span>Gradient Angle</span>
            </span>
            <span className="font-mono">{currentGradient.angle ?? 135}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={currentGradient.angle ?? 135}
            onChange={(e) => handleAngleChange(Number(e.target.value))}
            className="w-full accent-primary h-1.5 bg-border rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Quick Gradient Presets */}
      <div className="space-y-1.5 pt-2 border-t border-border/50">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Curated Gradient Presets
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {GRADIENT_PRESETS.map((preset) => {
            const presetCss = generateCssGradient(preset.config);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="h-6 w-14 rounded-md border border-border/60 shadow-2xs shrink-0 transition-transform hover:scale-105 cursor-pointer"
                style={{ background: presetCss }}
                title={preset.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
