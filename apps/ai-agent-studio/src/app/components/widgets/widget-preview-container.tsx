import React, { useState } from 'react';
import { Button, Badge } from '@org/ui';
import { cn } from '@org/utils';
import type { WidgetDefinition, WidgetState } from '@org/types';
import { WidgetRenderer } from './widget-renderer.js';
import {
  Laptop,
  Tablet,
  Smartphone,
  Play,
  Terminal,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface WidgetPreviewContainerProps {
  definition: Partial<WidgetDefinition>;
  onSave?: () => void;
  className?: string;
}

export function WidgetPreviewContainer({
  definition,
  className,
}: WidgetPreviewContainerProps) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewState, setPreviewState] = useState<WidgetState>('idle');
  const [actionLogs, setActionLogs] = useState<
    Array<{ id: string; timestamp: string; action: string; payload: any }>
  >([]);

  const handleAction = (actionName: string, payload?: any) => {
    const entry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      action: actionName,
      payload: payload || {},
    };
    setActionLogs((prev) => [entry, ...prev.slice(0, 9)]);
  };

  const deviceWidths = {
    desktop: 'w-full max-w-4xl',
    tablet: 'w-[680px]',
    mobile: 'w-[360px]',
  }[device];

  return (
    <div className={cn('flex flex-col h-full bg-background border border-border rounded-xl overflow-hidden', className)}>
      {/* Top Preview Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-surface-raised px-4 py-2.5 gap-2">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          <Button
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setDevice('desktop')}
            className="h-7 px-2.5 text-xs"
            title="Desktop Viewport"
          >
            <Laptop className="mr-1.5 size-3.5" /> Desktop
          </Button>
          <Button
            variant={device === 'tablet' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setDevice('tablet')}
            className="h-7 px-2.5 text-xs"
            title="Tablet Viewport (768px)"
          >
            <Tablet className="mr-1.5 size-3.5" /> Tablet
          </Button>
          <Button
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setDevice('mobile')}
            className="h-7 px-2.5 text-xs"
            title="Mobile Viewport (375px)"
          >
            <Smartphone className="mr-1.5 size-3.5" /> Mobile
          </Button>
        </div>

        {/* State Simulator */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Simulate State:</span>
          {(['idle', 'loading', 'empty', 'error'] as WidgetState[]).map((st) => (
            <Button
              key={st}
              variant={previewState === st ? 'outline' : 'ghost'}
              size="xs"
              onClick={() => setPreviewState(st)}
              className={cn(
                'h-7 capitalize text-[11px] px-2',
                previewState === st && 'border-primary/50 text-primary font-semibold'
              )}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto bg-dot-grid p-6 flex flex-col items-center justify-center min-h-[360px] relative">
        <div className={cn('transition-all duration-300 w-full', deviceWidths)}>
          <WidgetRenderer
            definition={definition}
            state={previewState}
            errorMessage={previewState === 'error' ? 'Simulated runtime evaluation failure: connection timed out.' : undefined}
            onAction={handleAction}
            onRefresh={() => handleAction('widget_refreshed', { manual: true })}
            size={definition.config?.size || 'md'}
          />
        </div>
      </div>

      {/* Bottom Event / Action Logger Console */}
      <div className="border-t border-border bg-surface-raised flex flex-col max-h-44 min-h-24">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-1.5 text-xs bg-surface">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Terminal className="size-3.5 text-primary" />
            <span>Widget Action & Event Stream</span>
            <Badge variant="subtle" className="text-[10px] font-mono">
              {actionLogs.length} events
            </Badge>
          </div>
          {actionLogs.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setActionLogs([])}
              className="text-[10px] h-6 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 bg-zinc-950/90 text-zinc-200">
          {actionLogs.length === 0 ? (
            <div className="text-zinc-500 italic py-2 text-center text-xs">
              Interact with buttons, forms, or charts in the preview above to view real-time action dispatches.
            </div>
          ) : (
            actionLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-500 text-[10px] shrink-0">{log.timestamp}</span>
                <span className="text-indigo-400 font-semibold shrink-0">[{log.action}]</span>
                <span className="text-zinc-300 truncate">
                  {JSON.stringify(log.payload)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
