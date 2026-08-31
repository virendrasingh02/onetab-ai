/**
 * Curated Theme Presets & Definition types.
 */

import type { ThemeConfig } from '@org/types';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  mode: 'light' | 'dark' | 'system';
  brandColor: string;
  neutralColor: string;
  previewColors: string[];
  config: ThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Fresh mint green primary on deep dark canvas.',
    mode: 'dark',
    brandColor: '#60c686',
    neutralColor: '#0a0a0a',
    previewColors: ['#60c686', '#0a0a0a', '#171717', '#37b06f'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'default',
      name: 'Default',
      brandColor: '#60c686',
      neutralColor: '#0a0a0a',
      colors: {
        primary: '#60c686',
        secondary: '#071812',
        background: '#0a0a0a',
        foreground: '#ffffff',
        card: '#171717',
        border: '#2e2e2e',
        muted: '#1f1f1f',
        accent: '#262626',
        input: '#262626',
        ring: '#60c686',
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
      },
    },
  },
  {
    id: 'blue',
    name: 'Blue',
    description: 'Electric blue and sapphire tones for focused productivity.',
    mode: 'dark',
    brandColor: '#3b82f6',
    neutralColor: '#0b1329',
    previewColors: ['#3b82f6', '#0b1329', '#1d283a', '#60a5fa'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'blue',
      name: 'Blue',
      brandColor: '#3b82f6',
      neutralColor: '#0b1329',
      colors: {
        primary: '#3b82f6',
        secondary: '#1e293b',
        background: '#0b1329',
        card: '#131e36',
        border: '#1e293b',
        accent: '#1d4ed8',
        ring: '#3b82f6',
      },
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
  },
  {
    id: 'purple',
    name: 'Purple',
    description: 'Deep violet and electric indigo tones with luminous accents.',
    mode: 'dark',
    brandColor: '#8b5cf6',
    neutralColor: '#0f0c1b',
    previewColors: ['#8b5cf6', '#0f0c1b', '#1e1b4b', '#c084fc'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'purple',
      name: 'Purple',
      brandColor: '#8b5cf6',
      neutralColor: '#0f0c1b',
      colors: {
        primary: '#8b5cf6',
        secondary: '#1e1b4b',
        background: '#0f0c1b',
        card: '#1a162b',
        border: '#2e264f',
        accent: '#7c3aed',
        ring: '#8b5cf6',
      },
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
  },
  {
    id: 'green',
    name: 'Green',
    description: 'Crisp emerald and forest jade tones with clean vibrancy.',
    mode: 'dark',
    brandColor: '#10b981',
    neutralColor: '#061a14',
    previewColors: ['#10b981', '#061a14', '#0f2922', '#34d399'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'green',
      name: 'Green',
      brandColor: '#10b981',
      neutralColor: '#061a14',
      colors: {
        primary: '#10b981',
        secondary: '#064e3b',
        background: '#061a14',
        card: '#0d2820',
        border: '#134e3f',
        accent: '#059669',
        ring: '#10b981',
      },
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
  },
  {
    id: 'orange',
    name: 'Orange',
    description: 'Warm ember amber and rich sunset terracotta highlights.',
    mode: 'dark',
    brandColor: '#f97316',
    neutralColor: '#140c06',
    previewColors: ['#f97316', '#140c06', '#2b170a', '#fb923c'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'orange',
      name: 'Orange',
      brandColor: '#f97316',
      neutralColor: '#140c06',
      colors: {
        primary: '#f97316',
        secondary: '#431407',
        background: '#140c06',
        card: '#241409',
        border: '#451a03',
        accent: '#ea580c',
        ring: '#f97316',
      },
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
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Vibrant magenta-rose and deep crimson-pink accents.',
    mode: 'dark',
    brandColor: '#f43f5e',
    neutralColor: '#14090c',
    previewColors: ['#f43f5e', '#14090c', '#271118', '#fb7185'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'rose',
      name: 'Rose',
      brandColor: '#f43f5e',
      neutralColor: '#14090c',
      colors: {
        primary: '#f43f5e',
        secondary: '#4c0519',
        background: '#14090c',
        card: '#241017',
        border: '#4c1122',
        accent: '#e11d48',
        ring: '#f43f5e',
      },
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
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Minimalist monochrome with clean neutral contrasts and silver accents.',
    mode: 'dark',
    brandColor: '#94a3b8',
    neutralColor: '#09090b',
    previewColors: ['#94a3b8', '#09090b', '#18181b', '#f8fafc'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'monochrome',
      name: 'Monochrome',
      brandColor: '#94a3b8',
      neutralColor: '#09090b',
      colors: {
        primary: '#f8fafc',
        primaryForeground: '#09090b',
        background: '#09090b',
        foreground: '#f8fafc',
        card: '#121215',
        border: '#27272a',
        muted: '#18181b',
        accent: '#27272a',
        ring: '#f8fafc',
      },
      gradients: {
        primary: {
          type: 'linear',
          angle: 180,
          stops: [
            { color: '#f8fafc', position: 0 },
            { color: '#94a3b8', position: 100 },
          ],
        },
      },
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'High-energy electric violet and vivid cyan neon highlights.',
    mode: 'dark',
    brandColor: '#ec15e7',
    neutralColor: '#10051d',
    previewColors: ['#ec15e7', '#10051d', '#220b3b', '#06b6d4'],
    config: {
      mode: 'dark',
      type: 'preset',
      presetId: 'cyberpunk',
      name: 'Cyberpunk',
      brandColor: '#ec15e7',
      neutralColor: '#10051d',
      colors: {
        primary: '#ec15e7',
        accent: '#06b6d4',
        background: '#10051d',
        card: '#1c0c30',
        border: '#38165c',
        ring: '#ec15e7',
      },
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
  },
];
