import type { GradientConfig, GradientStop } from '@org/types';
import { hexToRgb, isValidHexColor } from './theme-color-generator.js';

export interface GradientPreset {
  id: string;
  name: string;
  category: 'primary' | 'accent' | 'vibrant' | 'subtle' | 'dark';
  config: GradientConfig;
}

/** Formats a color and optional opacity into standard CSS color syntax. */
export function formatColorWithOpacity(hex: string, opacity?: number): string {
  if (!isValidHexColor(hex)) return hex;
  if (opacity === undefined || opacity === null || opacity >= 1) {
    return hex;
  }
  const rgb = hexToRgb(hex);
  const clampedAlpha = Math.max(0, Math.min(1, opacity));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedAlpha})`;
}

/** Converts structured GradientConfig into standard, safe CSS gradient syntax. */
export function generateCssGradient(gradient: GradientConfig | string | undefined | null, fallback = 'none'): string {
  if (!gradient) return fallback;
  if (typeof gradient === 'string') {
    // Basic sanitization: check if it looks like a valid CSS gradient
    if (/^(linear-gradient|radial-gradient|conic-gradient)\(/.test(gradient.trim())) {
      return gradient.trim();
    }
    if (isValidHexColor(gradient)) {
      return `linear-gradient(135deg, ${gradient} 0%, ${gradient} 100%)`;
    }
    return fallback;
  }

  if (!gradient.stops || gradient.stops.length === 0) {
    return fallback;
  }

  // Sort stops by position
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
  const formattedStops = sortedStops.map((stop) => {
    const colorStr = formatColorWithOpacity(stop.color, stop.opacity);
    const pos = Math.max(0, Math.min(100, Math.round(stop.position)));
    return `${colorStr} ${pos}%`;
  });

  if (gradient.type === 'radial') {
    const shape = gradient.shape === 'ellipse' ? 'ellipse at center' : 'circle at center';
    return `radial-gradient(${shape}, ${formattedStops.join(', ')})`;
  }

  // Linear gradient
  const angle = typeof gradient.angle === 'number' ? `${Math.round(gradient.angle % 360)}deg` : '135deg';
  return `linear-gradient(${angle}, ${formattedStops.join(', ')})`;
}

/** Checks whether an object adheres to the GradientConfig interface. */
export function isValidGradientConfig(val: unknown): val is GradientConfig {
  if (!val || typeof val !== 'object') return false;
  const g = val as Partial<GradientConfig>;
  if (g.type !== 'linear' && g.type !== 'radial') return false;
  if (!Array.isArray(g.stops) || g.stops.length < 2) return false;
  return g.stops.every(
    (s) =>
      typeof s === 'object' &&
      s !== null &&
      typeof s.color === 'string' &&
      typeof s.position === 'number' &&
      !isNaN(s.position),
  );
}

/** Curated Gradient Presets available for quick application. */
export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    category: 'primary',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#06b6d4', position: 0 },
        { color: '#3b82f6', position: 100 },
      ],
    },
  },
  {
    id: 'electric-sunset',
    name: 'Electric Sunset',
    category: 'accent',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#f43f5e', position: 0 },
        { color: '#f59e0b', position: 100 },
      ],
    },
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    category: 'vibrant',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#ec4899', position: 0 },
        { color: '#8b5cf6', position: 50 },
        { color: '#3b82f6', position: 100 },
      ],
    },
  },
  {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    category: 'primary',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#10b981', position: 0 },
        { color: '#06b6d4', position: 100 },
      ],
    },
  },
  {
    id: 'royal-velvet',
    name: 'Royal Velvet',
    category: 'accent',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#6366f1', position: 0 },
        { color: '#a855f7', position: 100 },
      ],
    },
  },
  {
    id: 'dark-titanium',
    name: 'Dark Titanium',
    category: 'dark',
    config: {
      type: 'linear',
      angle: 180,
      stops: [
        { color: '#1e293b', position: 0 },
        { color: '#0f172a', position: 100 },
      ],
    },
  },
  {
    id: 'golden-horizon',
    name: 'Golden Horizon',
    category: 'accent',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#f59e0b', position: 0 },
        { color: '#ef4444', position: 100 },
      ],
    },
  },
  {
    id: 'mint-fusion',
    name: 'Marketer Mint Fusion',
    category: 'primary',
    config: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#60c686', position: 0 },
        { color: '#0284c7', position: 100 },
      ],
    },
  },
  {
    id: 'radial-pulse',
    name: 'Radial Glow',
    category: 'vibrant',
    config: {
      type: 'radial',
      shape: 'circle',
      stops: [
        { color: '#8b5cf6', position: 0 },
        { color: '#3b82f6', position: 60 },
        { color: '#0f172a', position: 100 },
      ],
    },
  },
];
