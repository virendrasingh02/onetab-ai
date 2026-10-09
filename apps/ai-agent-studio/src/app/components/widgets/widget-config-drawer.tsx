import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Switch,
  Badge,
} from '@org/ui';
import { cn } from '@org/utils';
import type { WidgetCategory, WidgetComponentType } from '@org/types';
import { isWidgetCategory, type WidgetDraft } from './widget-draft.js';
import {
  Code,
  Sliders,
  Database,
  Layers,
  Palette,
  Shield,
  HelpCircle,
  Check,
} from 'lucide-react';

interface WidgetConfigDrawerProps {
  definition: WidgetDraft;
  onChange: (updated: WidgetDraft) => void;
  className?: string;
}

export function WidgetConfigDrawer({
  definition,
  onChange,
  className,
}: WidgetConfigDrawerProps) {
  const [tab, setTab] = useState<'visual' | 'code'>('visual');
  const [rawJson, setRawJson] = useState(() => JSON.stringify(definition, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Keep the JSON tab in step with edits made elsewhere (presets, loads).
  useEffect(() => {
    setRawJson(JSON.stringify(definition, null, 2));
  }, [definition]);

  const config = definition.config;

  const updateConfig = (key: string, val: any) => {
    const updated: WidgetDraft = {
      ...definition,
      config: {
        ...config,
        [key]: val,
      },
    };
    onChange(updated);
    setRawJson(JSON.stringify(updated, null, 2));
  };

  const updateRootField = <K extends keyof WidgetDraft>(key: K, val: WidgetDraft[K]) => {
    const updated: WidgetDraft = {
      ...definition,
      [key]: val,
    };
    onChange(updated);
    setRawJson(JSON.stringify(updated, null, 2));
  };

  const handleJsonBlur = () => {
    try {
      const parsed = JSON.parse(rawJson) as Partial<WidgetDraft>;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') {
        throw new Error('Expected an object with a string "name".');
      }
      if (!isWidgetCategory(parsed.category)) {
        throw new Error('"category" must be one of data_viz, interactive_input, ai_powered, app_connector, productivity.');
      }
      if (!parsed.config || typeof parsed.config.componentType !== 'string') {
        throw new Error('"config.componentType" is required.');
      }
      setJsonError(null);
      onChange({ ...definition, ...parsed } as WidgetDraft);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-surface border-l border-border text-foreground', className)}>
      {/* Header and Mode Switcher */}
      <div className="flex items-center justify-between border-b border-border p-3.5 bg-surface-raised">
        <div className="flex items-center gap-2">
          <Sliders className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Configuration
          </h3>
        </div>
        <div className="flex rounded-md border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab('visual')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
              tab === 'visual' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sliders className="size-3" /> Visual
          </button>
          <button
            type="button"
            onClick={() => {
              setRawJson(JSON.stringify(definition, null, 2));
              setTab('code');
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
              tab === 'code' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Code className="size-3" /> JSON
          </button>
        </div>
      </div>

      {tab === 'code' ? (
        <div className="flex-1 p-3 flex flex-col space-y-2">
          <label className="text-xs font-medium text-foreground">Direct JSON Definition</label>
          <textarea
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            onBlur={handleJsonBlur}
            rows={22}
            className="flex-1 w-full font-mono text-[11px] bg-zinc-950 text-zinc-100 p-3 rounded-md border border-border focus:outline-none focus:border-primary resize-none"
          />
          {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* General Metadata */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5 text-primary" /> Metadata
            </h4>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Widget Name</label>
              <Input
                value={definition.name || ''}
                onChange={(e) => updateRootField('name', e.target.value)}
                placeholder="e.g. Real-Time Conversion Metric"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Description</label>
              <Input
                value={definition.description || ''}
                onChange={(e) => updateRootField('description', e.target.value)}
                placeholder="Short summary for the widget center"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Category</label>
                <select
                  value={definition.category}
                  onChange={(e) => updateRootField('category', e.target.value as WidgetCategory)}
                  className="w-full h-8 px-2 rounded border border-border bg-surface-raised text-foreground focus:outline-none"
                >
                  <option value="data_viz">Data & Visualization</option>
                  <option value="interactive_input">Interactive Input</option>
                  <option value="ai_powered">AI-Powered</option>
                  <option value="app_connector">App Connector</option>
                  <option value="productivity">Productivity</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Component Type</label>
                <select
                  value={config.componentType || 'metric_card'}
                  onChange={(e) => updateConfig('componentType', e.target.value as WidgetComponentType)}
                  className="w-full h-8 px-2 rounded border border-border bg-surface-raised text-foreground focus:outline-none"
                >
                  <option value="metric_card">Metric Card</option>
                  <option value="bar_chart">Bar Chart</option>
                  <option value="line_chart">Line Chart</option>
                  <option value="area_chart">Area Chart</option>
                  <option value="table_view">Data Table</option>
                  <option value="progress_summary">Progress Summary</option>
                  <option value="text_input">Text Input</option>
                  <option value="dynamic_form">Dynamic Form</option>
                  <option value="approval_form">Approval Form</option>
                  <option value="ai_summary">AI Summary</option>
                  <option value="ai_extraction">Entity Extractor</option>
                  <option value="ai_sentiment">Sentiment Analysis</option>
                  <option value="connector_action">Action Card</option>
                  <option value="task_kanban">Task List</option>
                  <option value="meeting_summary">Meeting Notes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Visual Presentation */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Palette className="size-3.5 text-primary" /> Visual Presentation
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Display Size</label>
                <select
                  value={config.size || 'md'}
                  onChange={(e) => updateConfig('size', e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-surface-raised text-foreground focus:outline-none"
                >
                  <option value="sm">Small (1x1)</option>
                  <option value="md">Medium (2x1)</option>
                  <option value="lg">Large (3x2)</option>
                  <option value="full">Full Width</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Auto-Refresh</label>
                <select
                  value={config.refreshInterval || 0}
                  onChange={(e) => updateConfig('refreshInterval', parseInt(e.target.value, 10))}
                  className="w-full h-8 px-2 rounded border border-border bg-surface-raised text-foreground focus:outline-none"
                >
                  <option value={0}>Manual Only</option>
                  <option value={15}>Every 15s</option>
                  <option value={60}>Every 1m</option>
                  <option value={300}>Every 5m</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Display Title</label>
              <Input
                value={String(config.title ?? '')}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Card Header Title"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Footer / Attribution Text</label>
              <Input
                value={String(config.footerText ?? '')}
                onChange={(e) => updateConfig('footerText', e.target.value)}
                placeholder="e.g. Synced from Google Analytics"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Data & Binding */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Database className="size-3.5 text-primary" /> Data Source & Variables
            </h4>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Workflow Output Binding Path</label>
              <Input
                value={String(config.bindingPath ?? '')}
                onChange={(e) => updateConfig('bindingPath', e.target.value)}
                placeholder="e.g. {{steps.llm_call.output.data}}"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">Initial / Mock Data (JSON)</label>
              <textarea
                value={typeof config.initialData === 'object' ? JSON.stringify(config.initialData, null, 2) : String(config.initialData ?? '')}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateConfig('initialData', parsed);
                  } catch {
                    updateConfig('initialData', e.target.value);
                  }
                }}
                rows={5}
                placeholder='{"value": "1,280", "change": "+14%"}'
                className="w-full font-mono text-[11px] p-2 rounded border border-border bg-surface-raised text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Access & Permissions */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Shield className="size-3.5 text-primary" /> Workspace Access
            </h4>
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="font-medium text-foreground">Publish to Workspace</span>
                <p className="text-[11px] text-muted-foreground">Make visible to all workspace team members</p>
              </div>
              <Switch
                checked={definition.visibility !== 'PRIVATE'}
                onCheckedChange={(checked) =>
                  updateRootField('visibility', checked ? 'WORKSPACE' : 'PRIVATE')
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
