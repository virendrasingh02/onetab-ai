/**
 * Curated Theme Presets & Definition types.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  mode: 'light' | 'dark' | 'system';
  brandColor: string;
  neutralColor: string;
  previewColors: string[];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Marketer Mint (Default)',
    description: 'Fresh mint green primary on warm off-white / near-black canvas.',
    mode: 'dark',
    brandColor: '#60c686',
    neutralColor: '#0a0a0a',
    previewColors: ['#60c686', '#0a0a0a', '#171717', '#37b06f'],
  },
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Deep navy and electric indigo tones for high focus engineering.',
    mode: 'dark',
    brandColor: '#6366f1',
    neutralColor: '#0b0f19',
    previewColors: ['#6366f1', '#0b0f19', '#1e293b', '#818cf8'],
  },
  {
    id: 'graphite',
    name: 'Graphite Monochrome',
    description: 'Minimalist monochrome with clean neutral contrasts and silver accents.',
    mode: 'dark',
    brandColor: '#94a3b8',
    neutralColor: '#09090b',
    previewColors: ['#94a3b8', '#09090b', '#18181b', '#f8fafc'],
  },
  {
    id: 'forest',
    name: 'Emerald Forest',
    description: 'Deep evergreen and pine tones with crisp jade highlights.',
    mode: 'dark',
    brandColor: '#10b981',
    neutralColor: '#061a14',
    previewColors: ['#10b981', '#061a14', '#0f2922', '#34d399'],
  },
  {
    id: 'amber',
    name: 'Sunset Amber',
    description: 'Warm ember gold and rich terracotta tones.',
    mode: 'dark',
    brandColor: '#f59e0b',
    neutralColor: '#140f07',
    previewColors: ['#f59e0b', '#140f07', '#261b0c', '#fbbf24'],
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    description: 'Vibrant magenta-rose and deep crimson accents.',
    mode: 'dark',
    brandColor: '#f43f5e',
    neutralColor: '#14090c',
    previewColors: ['#f43f5e', '#14090c', '#271118', '#fb7185'],
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    description: 'High-energy electric violet and vivid cyan highlights.',
    mode: 'dark',
    brandColor: '#ec15e7',
    neutralColor: '#10051d',
    previewColors: ['#ec15e7', '#10051d', '#220b3b', '#06b6d4'],
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum contrast ratios for optimal accessibility and readability.',
    mode: 'dark',
    brandColor: '#38bdf8',
    neutralColor: '#000000',
    previewColors: ['#38bdf8', '#000000', '#121212', '#ffffff'],
  },
  {
    id: 'light-clean',
    name: 'Clean Daylight',
    description: 'Bright, modern clean daylight theme with vibrant sky blue.',
    mode: 'light',
    brandColor: '#0284c7',
    neutralColor: '#f8fafc',
    previewColors: ['#0284c7', '#f8fafc', '#ffffff', '#0f172a'],
  },
];
