import { describe, expect, it } from 'vitest';
import { COMPONENT_PRESETS } from './widget-component-palette.js';
import { WidgetRenderer } from './widget-renderer.js';

describe('WidgetRenderer & Presets', () => {
  it('exports valid component presets across 5 core categories', () => {
    expect(COMPONENT_PRESETS.length).toBeGreaterThanOrEqual(10);

    const categories = new Set(COMPONENT_PRESETS.map((p) => p.category));
    expect(categories.has('data_viz')).toBe(true);
    expect(categories.has('interactive_input')).toBe(true);
    expect(categories.has('ai_powered')).toBe(true);
    expect(categories.has('app_connector')).toBe(true);
    expect(categories.has('productivity')).toBe(true);
  });

  it('verifies presets have required metadata and configs', () => {
    COMPONENT_PRESETS.forEach((preset) => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.componentType).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.defaultConfig).toBeDefined();
    });
  });

  it('exports WidgetRenderer function component', () => {
    expect(typeof WidgetRenderer).toBe('function');
  });
});
