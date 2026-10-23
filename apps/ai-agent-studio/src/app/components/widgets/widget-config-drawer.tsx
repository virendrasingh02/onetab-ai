import { useEffect, useState } from 'react';
import {
  Input,
  Switch,
  AppSelect,
  Label,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
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
        <ToggleGroup
          type="single"
          size="sm"
          aria-label="Editor mode"
          value={tab}
          onValueChange={(v) => {
            if (v === 'code') setRawJson(JSON.stringify(definition, null, 2));
            if (v) setTab(v as 'visual' | 'code');
          }}
        >
          <ToggleGroupItem value="visual" className="gap-1 px-2.5">
            <Sliders className="size-3" /> Visual
          </ToggleGroupItem>
          <ToggleGroupItem value="code" className="gap-1 px-2.5">
            <Code className="size-3" /> JSON
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tab === 'code' ? (
        <div className="flex-1 p-3 flex flex-col space-y-2">
          <Label className="text-xs font-medium text-foreground">Direct JSON Definition</Label>
          <Textarea value={rawJson} onChange={(e) => setRawJson(e.target.value)} onBlur={handleJsonBlur} rows={22} className="flex-1 font-mono text-xs resize-none" />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* General Metadata */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5 text-primary" /> Metadata
            </h4>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Widget Name</Label>
              <Input
                value={definition.name || ''}
                onChange={(e) => updateRootField('name', e.target.value)}
                placeholder="e.g. Real-Time Conversion Metric"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={definition.description || ''}
                onChange={(e) => updateRootField('description', e.target.value)}
                placeholder="Short summary for the widget center"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <AppSelect
                  value={definition.category}
                  onValueChange={(v) => updateRootField('category', v as WidgetCategory)}
                  options={[
                    { value: 'data_viz', label: 'Data & Visualization' },
                    { value: 'interactive_input', label: 'Interactive Input' },
                    { value: 'ai_powered', label: 'AI-Powered' },
                    { value: 'app_connector', label: 'App Connector' },
                    { value: 'productivity', label: 'Productivity' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Component Type</Label>
                <AppSelect
                  value={config.componentType || 'metric_card'}
                  onValueChange={(v) => updateConfig('componentType', v as WidgetComponentType)}
                  options={[
                    { value: 'metric_card', label: 'Metric Card' },
                    { value: 'bar_chart', label: 'Bar Chart' },
                    { value: 'line_chart', label: 'Line Chart' },
                    { value: 'area_chart', label: 'Area Chart' },
                    { value: 'table_view', label: 'Data Table' },
                    { value: 'progress_summary', label: 'Progress Summary' },
                    { value: 'text_input', label: 'Text Input' },
                    { value: 'dynamic_form', label: 'Dynamic Form' },
                    { value: 'approval_form', label: 'Approval Form' },
                    { value: 'ai_summary', label: 'AI Summary' },
                    { value: 'ai_extraction', label: 'Entity Extractor' },
                    { value: 'ai_sentiment', label: 'Sentiment Analysis' },
                    { value: 'connector_action', label: 'Action Card' },
                    { value: 'task_kanban', label: 'Task List' },
                    { value: 'meeting_summary', label: 'Meeting Notes' },
                  ]}
                />
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
                <Label className="text-xs text-muted-foreground">Display Size</Label>
                <AppSelect
                  value={config.size || 'md'}
                  onValueChange={(v) => updateConfig('size', v)}
                  options={[
                    { value: 'sm', label: 'Small (1x1)' },
                    { value: 'md', label: 'Medium (2x1)' },
                    { value: 'lg', label: 'Large (3x2)' },
                    { value: 'full', label: 'Full Width' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Auto-Refresh</Label>
                <AppSelect
                  value={String(config.refreshInterval || 0)}
                  onValueChange={(v) => updateConfig('refreshInterval', parseInt(v, 10))}
                  options={[
                    { value: '0', label: 'Manual Only' },
                    { value: '15', label: 'Every 15s' },
                    { value: '60', label: 'Every 1m' },
                    { value: '300', label: 'Every 5m' },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Display Title</Label>
              <Input
                value={String(config.title ?? '')}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Card Header Title"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Footer / Attribution Text</Label>
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
              <Label className="text-xs text-muted-foreground">Workflow Output Binding Path</Label>
              <Input
                value={String(config.bindingPath ?? '')}
                onChange={(e) => updateConfig('bindingPath', e.target.value)}
                placeholder="e.g. {{steps.llm_call.output.data}}"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Initial / Mock Data (JSON)</Label>
              <Textarea
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
                className="font-mono text-xs"
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
                <p className="text-xs text-muted-foreground">Make visible to all workspace team members</p>
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
