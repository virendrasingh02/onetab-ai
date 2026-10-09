import React, { useState } from 'react';
import { Input, Badge } from '@org/ui';
import { cn } from '@org/utils';
import type { WidgetCategory, WidgetComponentType } from '@org/types';
import {
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  FormInput,
  Layers,
  LineChart,
  ListTodo,
  MessageSquare,
  Search,
  Sparkles,
  Table,
  UserCheck,
  Zap,
} from 'lucide-react';

export interface WidgetPreset {
  id: string;
  name: string;
  category: WidgetCategory;
  componentType: WidgetComponentType;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultConfig: Record<string, any>;
}

export const COMPONENT_PRESETS: WidgetPreset[] = [
  // 1. Data & Viz
  {
    id: 'preset-metric',
    name: 'Metric Card',
    category: 'data_viz',
    componentType: 'metric_card',
    description: 'KPI counter with percentage trend indicator and drill-down link.',
    icon: BarChart3,
    defaultConfig: {
      title: 'Monthly Active Invocations',
      value: '48,290',
      change: '+18.4%',
      metricLabel: 'Across 12 agents',
      size: 'sm',
      drillDownAction: true,
    },
  },
  {
    id: 'preset-bar-chart',
    name: 'Bar Chart',
    category: 'data_viz',
    componentType: 'bar_chart',
    description: 'Comparative bar distribution across categories or days.',
    icon: BarChart3,
    defaultConfig: {
      title: 'Agent Tool Executions',
      description: 'Daily volume over last 7 days',
      size: 'md',
      color: '#6366f1',
    },
  },
  {
    id: 'preset-line-chart',
    name: 'Trend Line Chart',
    category: 'data_viz',
    componentType: 'line_chart',
    description: 'Continuous time-series performance and latency tracking.',
    icon: LineChart,
    defaultConfig: {
      title: 'LLM P95 Response Latency',
      size: 'md',
      color: '#8b5cf6',
    },
  },
  {
    id: 'preset-table',
    name: 'Data Table',
    category: 'data_viz',
    componentType: 'table_view',
    description: 'Filterable table with search, status pills, and CSV export.',
    icon: Table,
    defaultConfig: {
      title: 'Execution Trace Records',
      size: 'lg',
    },
  },
  {
    id: 'preset-progress',
    name: 'Progress Summary',
    category: 'data_viz',
    componentType: 'progress_summary',
    description: 'Visual progress gauges for token caps, tasks, and budgets.',
    icon: CheckCircle2,
    defaultConfig: {
      title: 'Orchestration Health & Limits',
      size: 'md',
    },
  },

  // 2. Interactive Input
  {
    id: 'preset-form-input',
    name: 'Parameter Input',
    category: 'interactive_input',
    componentType: 'text_input',
    description: 'Interactive field to pass parameters directly to agents.',
    icon: FormInput,
    defaultConfig: {
      title: 'Prompt Variable Injector',
      inputLabel: 'User Query / Instructions',
      buttonLabel: 'Dispatch to Agent',
      size: 'sm',
    },
  },
  {
    id: 'preset-dynamic-form',
    name: 'Dynamic Form',
    category: 'interactive_input',
    componentType: 'dynamic_form',
    description: 'Schema-driven multi-input form with validation.',
    icon: Layers,
    defaultConfig: {
      title: 'Agent Research Parameters',
      size: 'md',
    },
  },
  {
    id: 'preset-approval',
    name: 'Human Approval Form',
    category: 'interactive_input',
    componentType: 'approval_form',
    description: 'Interactive gate requiring user confirmation before action.',
    icon: UserCheck,
    defaultConfig: {
      title: 'Sensitive Action Approval',
      actionName: 'Deploy Marketing Email Broadcast',
      size: 'md',
    },
  },

  // 3. AI-Powered
  {
    id: 'preset-ai-summary',
    name: 'AI Summary Card',
    category: 'ai_powered',
    componentType: 'ai_summary',
    description: 'Synthesized intelligence with confidence score and copy button.',
    icon: Sparkles,
    defaultConfig: {
      title: 'Intelligence Executive Brief',
      confidence: '98%',
      size: 'md',
    },
  },
  {
    id: 'preset-entity-extractor',
    name: 'Entity Extractor',
    category: 'ai_powered',
    componentType: 'ai_extraction',
    description: 'Displays structured tags for discovered entities.',
    icon: Database,
    defaultConfig: {
      title: 'Named Entity Recognition',
      size: 'md',
    },
  },

  // 4. App Connector
  {
    id: 'preset-action-card',
    name: 'Connector Action Card',
    category: 'app_connector',
    componentType: 'connector_action',
    description: 'Immediate action trigger via connected workspace apps.',
    icon: Zap,
    defaultConfig: {
      title: 'Slack Workspace Broadcast',
      connectorName: 'Slack',
      actionTitle: 'Send Urgent Operational Alert',
      size: 'sm',
    },
  },

  // 5. Productivity
  {
    id: 'preset-tasks',
    name: 'Checklist & Tasks',
    category: 'productivity',
    componentType: 'task_kanban',
    description: 'Actionable todo list with real-time toggle states.',
    icon: ListTodo,
    defaultConfig: {
      title: 'Operational Checklist',
      size: 'md',
    },
  },
  {
    id: 'preset-meeting-notes',
    name: 'Meeting & Action Notes',
    category: 'productivity',
    componentType: 'meeting_summary',
    description: 'Structured recap with attendee list and export to docs.',
    icon: FileText,
    defaultConfig: {
      title: 'AI Sprint Review Notes',
      size: 'md',
    },
  },
];

interface WidgetComponentPaletteProps {
  onSelectPreset: (preset: WidgetPreset) => void;
  className?: string;
}

export function WidgetComponentPalette({
  onSelectPreset,
  className,
}: WidgetComponentPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');

  const filtered = COMPONENT_PRESETS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'ALL' || p.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className={cn('flex flex-col h-full bg-surface border-r border-border text-foreground', className)}>
      <div className="p-3 border-b border-border space-y-2 bg-surface-raised">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Component Library
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components…"
            className="h-8 pl-8 text-xs bg-surface"
          />
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {['ALL', 'data_viz', 'interactive_input', 'ai_powered', 'app_connector', 'productivity'].map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  selectedCat === cat
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {cat === 'ALL' ? 'All' : cat.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((preset) => {
          const Icon = preset.icon;
          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="p-3 rounded-lg border border-border/70 bg-surface hover:bg-surface-raised hover:border-primary/50 transition-all cursor-pointer group shadow-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded p-1 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                </div>
                <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0">
                  {preset.category.split('_')[0]}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-6">
                {preset.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
