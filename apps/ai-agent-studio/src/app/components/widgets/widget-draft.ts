import type {
  WidgetAppearanceConfig,
  WidgetCategory,
  WidgetComponentType,
  WidgetDataSourceConfig,
  WidgetDefinition,
  WidgetStatus,
  WidgetTemplateItem,
  WidgetVisibility,
} from '@org/types';
import { WIDGET_CATEGORIES } from '@org/types';

/**
 * The builder edits a flat `config` bag (component type, size, refresh and
 * every display prop the renderer reads). The API stores the same widget as
 * a structured `WidgetDefinition`: the component type and appearance are
 * first-class columns and display props live in `sampleData` — the same place
 * the server's own templates keep them. This module is the only translation
 * point between the two.
 */

/** Preview states the renderer can be forced into. */
export type WidgetState = 'idle' | 'loading' | 'empty' | 'error';

export type WidgetUiSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetUiConfig {
  componentType: WidgetComponentType;
  size?: WidgetUiSize;
  /** Seconds between automatic refreshes; 0 = manual. */
  refreshInterval?: number;
  initialData?: unknown;
  [key: string]: unknown;
}

export interface WidgetDraft {
  name: string;
  description?: string;
  category: WidgetCategory;
  visibility: WidgetVisibility;
  version?: number;
  status?: WidgetStatus;
  config: WidgetUiConfig;
}

const SIZE_TO_APPEARANCE: Record<WidgetUiSize, WidgetAppearanceConfig['size']> = {
  sm: 'compact',
  md: 'standard',
  lg: 'large',
  full: 'full',
};

const APPEARANCE_TO_SIZE: Record<WidgetAppearanceConfig['size'], WidgetUiSize> = {
  compact: 'sm',
  standard: 'md',
  large: 'lg',
  full: 'full',
};

/** Keys of `WidgetUiConfig` that map to columns rather than `sampleData`. */
const STRUCTURAL_KEYS = new Set(['componentType', 'size', 'refreshInterval']);

export function isWidgetCategory(value: unknown): value is WidgetCategory {
  return typeof value === 'string' && (WIDGET_CATEGORIES as readonly string[]).includes(value);
}

export function createDefaultDraft(): WidgetDraft {
  return {
    name: 'Untitled Widget',
    description: 'Configure and link this widget to agents, workflows, or dashboards.',
    category: 'data_viz',
    visibility: 'WORKSPACE',
    config: {
      componentType: 'metric_card',
      title: 'Active Agent Invocations',
      value: '1,420',
      change: '+12.5%',
      metricLabel: 'Monthly Total',
      size: 'md',
      refreshInterval: 0,
      initialData: { value: '1,420', change: '+12.5%' },
    },
  };
}

function uiConfigFrom(
  componentType: WidgetComponentType,
  appearance: Partial<WidgetAppearanceConfig> | undefined,
  dataSource: Partial<WidgetDataSourceConfig> | undefined,
  sampleData: Record<string, unknown> | undefined,
): WidgetUiConfig {
  return {
    ...(sampleData ?? {}),
    componentType,
    size: appearance?.size ? APPEARANCE_TO_SIZE[appearance.size] : 'md',
    refreshInterval: dataSource?.autoRefresh ? (dataSource.refreshIntervalSec ?? 0) : 0,
  };
}

export function draftFromDefinition(def: WidgetDefinition): WidgetDraft {
  return {
    name: def.name,
    description: def.description,
    category: def.category,
    visibility: def.visibility,
    version: def.version,
    status: def.status,
    config: uiConfigFrom(def.componentType, def.appearance, def.dataSource, def.sampleData),
  };
}

export function draftFromTemplate(tpl: WidgetTemplateItem): WidgetDraft {
  return {
    name: `${tpl.name} (Copy)`,
    description: tpl.description,
    category: tpl.category,
    visibility: 'WORKSPACE',
    config: uiConfigFrom(
      tpl.componentType,
      tpl.defaultConfig?.appearance,
      tpl.defaultConfig?.dataSource,
      tpl.sampleData,
    ),
  };
}

/**
 * Request body for `widgetsApi.create` / `widgetsApi.update`. Pass the stored
 * definition as `base` on update so appearance/data-source settings the
 * builder doesn't expose are kept rather than reset.
 */
export function draftToPayload(draft: WidgetDraft, base?: WidgetDefinition): Record<string, unknown> {
  const sampleData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft.config)) {
    if (!STRUCTURAL_KEYS.has(key)) sampleData[key] = value;
  }
  const refresh = Number(draft.config.refreshInterval) || 0;
  const dataSource: Partial<WidgetDataSourceConfig> = {
    type: 'static_sample',
    apiMethod: 'GET',
    ...base?.dataSource,
    autoRefresh: refresh > 0,
  };
  if (refresh > 0) dataSource.refreshIntervalSec = refresh;
  else delete dataSource.refreshIntervalSec;

  return {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    componentType: draft.config.componentType,
    visibility: draft.visibility,
    appearance: {
      colorTheme: 'default',
      customHeader: true,
      showIcon: true,
      showBorder: true,
      roundedRadius: 'md',
      ...base?.appearance,
      size: SIZE_TO_APPEARANCE[draft.config.size ?? 'md'],
    },
    dataSource,
    sampleData,
  };
}
