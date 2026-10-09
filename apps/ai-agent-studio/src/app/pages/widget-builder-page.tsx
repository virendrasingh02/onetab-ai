import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Badge, toast } from '@org/ui';
import { widgetsApi } from '@org/api-client';
import { useStudioSession } from '../session-guard.js';
import type { WidgetDefinition } from '@org/types';
import { WidgetComponentPalette } from '../components/widgets/widget-component-palette.js';
import { WidgetPreviewContainer } from '../components/widgets/widget-preview-container.js';
import { WidgetConfigDrawer } from '../components/widgets/widget-config-drawer.js';
import {
  createDefaultDraft,
  draftFromDefinition,
  draftFromTemplate,
  draftToPayload,
  type WidgetDraft,
} from '../components/widgets/widget-draft.js';
import type { WidgetPreset } from '../components/widgets/widget-component-palette.js';
import {
  ArrowLeft,
  Save,
  Play,
  RotateCcw,
  Sparkles,
  Share2,
  Copy,
  Sliders,
  CheckCircle2,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

export function WidgetBuilderPage() {
  const { widgetId } = useParams<{ widgetId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();

  const isNew = !widgetId || widgetId === 'new';

  const [definition, setDefinition] = useState<WidgetDraft>(createDefaultDraft);
  // The stored definition, so saves keep settings the builder doesn't edit.
  const [stored, setStored] = useState<WidgetDefinition | undefined>();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  // Load existing widget or preloaded template
  useEffect(() => {
    if (!isNew && widgetId) {
      setLoading(true);
      widgetsApi
        .get(activeWorkspace.id, widgetId)
        .then((res) => {
          setStored(res);
          setDefinition(draftFromDefinition(res));
        })
        .catch((err: any) => {
          console.error('Failed to load widget:', err);
          toast.error('Failed to load widget definition');
        })
        .finally(() => setLoading(false));
    } else {
      const templateId = searchParams.get('template');
      if (templateId) {
        widgetsApi
          .listTemplates(activeWorkspace.id)
          .then((templates) => {
            const found = templates.find((tpl) => tpl.id === templateId);
            if (found) {
              setDefinition(draftFromTemplate(found));
              toast.success(`Loaded template: ${found.name}`);
            }
          })
          .catch(console.error);
      }
    }
  }, [isNew, widgetId, activeWorkspace.id, searchParams]);

  const handleSave = async () => {
    if (!definition.name) {
      toast.error('Widget name is required');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await widgetsApi.create(activeWorkspace.id, draftToPayload(definition));
        toast.success('Widget created successfully!');
        navigate(`/widgets/${created.id}`, { replace: true });
      } else if (widgetId) {
        const updated = await widgetsApi.update(
          activeWorkspace.id,
          widgetId,
          draftToPayload(definition, stored),
        );
        setStored(updated);
        setDefinition(draftFromDefinition(updated));
        toast.success('Widget saved and versioned!');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err?.message || 'Failed to save widget');
    } finally {
      setSaving(false);
    }
  };

  const handleTestExecution = async () => {
    setTesting(true);
    try {
      if (widgetId && !isNew) {
        const res = await widgetsApi.executeAction(activeWorkspace.id, widgetId, {
          action: 'test_run',
          payload: { timestamp: new Date().toISOString() },
        });
        toast.success('Test execution completed with status: ' + (res.status || 'success'));
      } else {
        toast.info('Save the widget first to run a test execution.');
      }
    } catch (err: any) {
      toast.error('Test execution failed: ' + (err.message || 'Error'));
    } finally {
      setTesting(false);
    }
  };

  const handleSelectPreset = (preset: WidgetPreset) => {
    setDefinition((prev) => ({
      ...prev,
      category: preset.category,
      config: {
        ...prev.config,
        ...preset.defaultConfig,
        componentType: preset.componentType,
      },
    }));
    toast.info(`Switched component to ${preset.name}`);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">Loading widget definition...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => navigate('/widgets')}
            className="text-muted-foreground hover:text-foreground h-8"
          >
            <ArrowLeft className="mr-1.5 size-4" /> Widgets
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              {definition.name || 'Untitled Widget'}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              v{definition.version ?? 1}
            </Badge>
            {definition.visibility !== 'PRIVATE' && (
              <Badge variant="secondary" className="text-[10px] text-emerald-500">
                Workspace Shared
              </Badge>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Panel toggles */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowLeft((p) => !p)}
            className="text-muted-foreground"
            title={showLeft ? 'Hide components' : 'Show components'}
          >
            {showLeft ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowRight((p) => !p)}
            className="text-muted-foreground"
            title={showRight ? 'Hide configuration' : 'Show configuration'}
          >
            {showRight ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestExecution}
            disabled={testing}
            className="text-xs h-8"
          >
            {testing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5 text-primary" />}
            Test Run
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs h-8"
          >
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            {isNew ? 'Create Widget' : 'Save & Publish'}
          </Button>
        </div>
      </header>

      {/* 3-Panel Builder Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Palette */}
        {showLeft && (
          <aside className="w-72 shrink-0 h-full overflow-hidden transition-all">
            <WidgetComponentPalette onSelectPreset={handleSelectPreset} />
          </aside>
        )}

        {/* Center Live Preview */}
        <main className="flex-1 h-full min-w-0 p-4 bg-muted/20 overflow-hidden">
          <WidgetPreviewContainer definition={definition} className="h-full" />
        </main>

        {/* Right Configuration Drawer */}
        {showRight && (
          <aside className="w-84 shrink-0 h-full overflow-hidden transition-all">
            <WidgetConfigDrawer definition={definition} onChange={setDefinition} />
          </aside>
        )}
      </div>
    </div>
  );
}
