/**
 * Curated Theme Presets & Definition types.
 *
 * A preset is a *brand identity*, not a full palette: it carries the primary
 * hue, a neutral canvas hue, status colors and gradients. The surfaces
 * (background, card, border, muted, …) are synthesized per mode by
 * `generateThemeVariables`, so every preset works in both light and dark and
 * follows whatever Color Mode the user is on — applying one never forces dark.
 */

import type { ThemeConfig } from '@org/types';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Presets are mode-agnostic; applying one keeps the user's current mode. */
  mode: 'light' | 'dark' | 'system';
  brandColor: string;
  /** Only the *hue* is used — surfaces are derived light/dark from it. */
  neutralColor: string;
  previewColors: string[];
  config: ThemeConfig;
}

interface PresetSeed {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  neutralColor: string;
  previewColors: string[];
  /** Identity colors only — never surfaces. */
  colors?: ThemeConfig['colors'];
  gradients?: ThemeConfig['gradients'];
}

function toPreset(seed: PresetSeed): ThemePreset {
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    mode: 'system',
    brandColor: seed.brandColor,
    neutralColor: seed.neutralColor,
    previewColors: seed.previewColors,
    config: {
      mode: 'system',
      type: seed.id === 'default' ? 'default' : 'preset',
      presetId: seed.id,
      name: seed.name,
      brandColor: seed.brandColor,
      neutralColor: seed.neutralColor,
      colors: {
        primary: seed.brandColor,
        ring: seed.brandColor,
        ...seed.colors,
      },
      ...(seed.gradients ? { gradients: seed.gradients } : {}),
    },
  };
}

const PRESET_SEEDS: PresetSeed[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Fresh mint green primary on the platform canvas.',
    brandColor: '#60c686',
    neutralColor: '#fcfbf8',
    previewColors: ['#60c686', '#037152', '#fcfbf8', '#11271f'],
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
  },
  {
    id: 'blue',
    name: 'Blue',
    description: 'Electric blue and sapphire tones for focused productivity.',
    brandColor: '#3b82f6',
    neutralColor: '#0b1329',
    previewColors: ['#3b82f6', '#60a5fa', '#1d283a', '#0b1329'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#3b82f6', position: 0 },
          { color: '#06b6d4', position: 100 },
        ],
      },
      accent: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#2563eb', position: 0 },
          { color: '#38bdf8', position: 100 },
        ],
      },
    },
  },
  {
    id: 'purple',
    name: 'Purple',
    description: 'Deep violet and electric indigo tones with luminous accents.',
    brandColor: '#8b5cf6',
    neutralColor: '#0f0c1b',
    previewColors: ['#8b5cf6', '#c084fc', '#1e1b4b', '#0f0c1b'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#8b5cf6', position: 0 },
          { color: '#ec4899', position: 100 },
        ],
      },
      accent: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#7c3aed', position: 0 },
          { color: '#d946ef', position: 100 },
        ],
      },
    },
  },
  {
    id: 'green',
    name: 'Green',
    description: 'Crisp emerald and forest jade tones with clean vibrancy.',
    brandColor: '#10b981',
    neutralColor: '#061a14',
    previewColors: ['#10b981', '#34d399', '#0f2922', '#061a14'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#10b981', position: 0 },
          { color: '#14b8a6', position: 100 },
        ],
      },
    },
  },
  {
    id: 'orange',
    name: 'Orange',
    description: 'Warm ember amber and rich sunset terracotta highlights.',
    brandColor: '#f97316',
    neutralColor: '#140c06',
    previewColors: ['#f97316', '#fb923c', '#2b170a', '#140c06'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#f97316', position: 0 },
          { color: '#eab308', position: 100 },
        ],
      },
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Vibrant magenta-rose and deep crimson-pink accents.',
    brandColor: '#f43f5e',
    neutralColor: '#14090c',
    previewColors: ['#f43f5e', '#fb7185', '#271118', '#14090c'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#f43f5e', position: 0 },
          { color: '#a855f7', position: 100 },
        ],
      },
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Minimalist neutral contrasts with silver accents.',
    brandColor: '#64748b',
    neutralColor: '#09090b',
    previewColors: ['#64748b', '#94a3b8', '#27272a', '#09090b'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#94a3b8', position: 0 },
          { color: '#64748b', position: 100 },
        ],
      },
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'High-energy electric violet and vivid cyan neon highlights.',
    brandColor: '#ec15e7',
    neutralColor: '#10051d',
    previewColors: ['#ec15e7', '#06b6d4', '#220b3b', '#10051d'],
    gradients: {
      primary: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#ec15e7', position: 0 },
          { color: '#06b6d4', position: 100 },
        ],
      },
    },
  },
];

export const THEME_PRESETS: ThemePreset[] = PRESET_SEEDS.map(toPreset);
