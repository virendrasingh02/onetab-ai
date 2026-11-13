import React, { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Badge,
  Label,
  Checkbox,
  AppSelect,
} from '@org/ui';
import { cn } from '@org/utils';
import type { WidgetDraft, WidgetState } from './widget-draft.js';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface WidgetRendererProps {
  definition?: Partial<WidgetDraft>;
  componentType?: string;
  config?: Record<string, any>;
  data?: any;
  state?: WidgetState;
  errorMessage?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  onAction?: (actionName: string, payload?: any) => void | Promise<void>;
  onRefresh?: () => void;
  className?: string;
}

export function WidgetRenderer({
  definition,
  componentType: directComponentType,
  config: directConfig,
  data: directData,
  state = 'idle',
  errorMessage,
  size = 'md',
  onAction,
  onRefresh,
  className,
}: WidgetRendererProps) {
  const componentType =
    directComponentType || definition?.config?.componentType || 'metric_card';

  const config = useMemo(
    () => ({
      ...(definition?.config || {}),
      ...(directConfig || {}),
    }),
    [definition?.config, directConfig],
  );

  const rawData =
    directData !== undefined ? directData : definition?.config?.initialData;

  const sizeClasses = {
    sm: 'col-span-1 min-h-[160px]',
    md: 'col-span-1 md:col-span-2 min-h-[240px]',
    lg: 'col-span-1 md:col-span-3 min-h-[340px]',
    full: 'col-span-full min-h-[380px]',
  }[size];

  // Render Loading State
  if (state === 'loading') {
    return (
      <Card
        className={cn(
          'p-5 relative flex flex-col justify-between overflow-hidden border-border bg-surface',
          sizeClasses,
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <div className="space-y-3 py-6">
          <div className="h-8 animate-pulse w-2/3 rounded-md bg-muted" />
          <div className="h-4 animate-pulse w-full rounded-md bg-muted/60" />
          <div className="h-4 animate-pulse w-4/5 rounded-md bg-muted/40" />
        </div>
        <div className="pt-2 flex items-center justify-between border-t border-border/50">
          <div className="h-3 w-20 animate-pulse rounded-md bg-muted/50" />
          <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
        </div>
      </Card>
    );
  }

  // Render Error State
  if (state === 'error' || errorMessage) {
    return (
      <Card
        className={cn(
          'p-6 space-y-3 flex flex-col items-center justify-center border-destructive/40 bg-destructive/5 text-center',
          sizeClasses,
          className,
        )}
      >
        <div className="p-3 rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-destructive">
            Widget Execution Error
          </h4>
          <p className="text-xs max-w-sm text-muted-foreground">
            {errorMessage ||
              'Failed to retrieve data or execute widget action. Verify connection parameters.'}
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="mt-2 text-xs"
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Retry
          </Button>
        )}
      </Card>
    );
  }

  // Render Empty State if explicitly empty or no data
  if (state === 'empty') {
    return (
      <Card
        className={cn(
          'p-6 space-y-2.5 flex flex-col items-center justify-center border-dashed border-border/60 bg-surface/50 text-center',
          sizeClasses,
          className,
        )}
      >
        <div className="p-2.5 rounded-full bg-muted text-muted-foreground">
          <Layers className="size-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-foreground">
            No Data Available
          </h4>
          <p className="text-xs max-w-xs text-muted-foreground">
            This widget hasn't received any telemetry or records yet.
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onRefresh}
            className="text-xs text-primary"
          >
            <RefreshCw className="mr-1.5 size-3" /> Refresh
          </Button>
        )}
      </Card>
    );
  }

  // Polymorphic Content Dispatcher
  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden border-border bg-surface shadow-sm transition-all hover:shadow-md',
        sizeClasses,
        className,
      )}
    >
      <CardHeader className="space-y-0 pb-2 flex flex-row items-start justify-between">
        <div className="space-y-1 min-w-0 pr-2">
          <CardTitle className="text-sm font-semibold truncate text-foreground">
            {config.title || definition?.name || 'Widget'}
          </CardTitle>
          {(config.description || definition?.description) && (
            <CardDescription className="text-xs truncate text-muted-foreground">
              {config.description || definition?.description}
            </CardDescription>
          )}
        </div>
        <div className="gap-1 flex shrink-0 items-center">
          {definition?.category && (
            <Badge
              variant="outline"
              className="tracking-wider font-mono text-2xs text-muted-foreground uppercase"
            >
              {definition.category}
            </Badge>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRefresh}
              className="text-muted-foreground hover:text-foreground"
              title="Refresh widget"
            >
              <RefreshCw className="size-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 min-h-0 flex flex-1 flex-col">
        {renderWidgetBody({
          componentType,
          config,
          data: rawData,
          onAction,
        })}
      </CardContent>

      {config.footerText && (
        <CardFooter className="py-2 px-4 flex items-center justify-between border-t border-border/40 text-2xs text-muted-foreground">
          <span>{config.footerText}</span>
          <span className="font-mono text-2xs opacity-75">
            v{definition?.version ?? 1}
          </span>
        </CardFooter>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Category Sub-Renderers
// ---------------------------------------------------------------------------

function renderWidgetBody({
  componentType,
  config,
  data,
  onAction,
}: {
  componentType: string;
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void | Promise<void>;
}) {
  const normType = (componentType || '').toLowerCase();

  switch (normType) {
    // 1. Metric / KPI Card
    case 'metric_card':
    case 'data_visualization':
      return (
        <MetricCardContent config={config} data={data} onAction={onAction} />
      );

    // 2. Bar Chart
    case 'bar_chart':
      return (
        <BarChartContent config={config} data={data} onAction={onAction} />
      );

    // 3. Line Chart / Area Chart
    case 'line_chart':
    case 'area_chart':
      return (
        <LineChartContent
          config={config}
          data={data}
          isArea={normType === 'area_chart'}
          onAction={onAction}
        />
      );

    // 4. Table View
    case 'table_view':
    case 'data_table':
      return (
        <TableViewContent config={config} data={data} onAction={onAction} />
      );

    // 5. Progress Summary
    case 'progress_summary':
      return (
        <ProgressSummaryContent
          config={config}
          data={data}
          onAction={onAction}
        />
      );

    // 6. Interactive Form Input
    case 'text_input':
    case 'form_input':
    case 'interactive_input':
      return (
        <FormInputContent config={config} data={data} onAction={onAction} />
      );

    // 7. Dynamic Form
    case 'dynamic_form':
      return (
        <DynamicFormContent config={config} data={data} onAction={onAction} />
      );

    // 8. Human Approval Form
    case 'approval_form':
      return (
        <ApprovalFormContent config={config} data={data} onAction={onAction} />
      );

    // 9. AI Summary
    case 'ai_summary':
    case 'ai_powered':
      return (
        <AiSummaryContent config={config} data={data} onAction={onAction} />
      );

    // 10. Entity Extractor
    case 'ai_extraction':
    case 'entity_extractor':
      return (
        <EntityExtractorContent
          config={config}
          data={data}
          onAction={onAction}
        />
      );

    // 11. Sentiment Analysis
    case 'ai_sentiment':
    case 'sentiment_analysis':
      return (
        <SentimentContent config={config} data={data} onAction={onAction} />
      );

    // 12. App Connector Action Card
    case 'connector_action':
    case 'action_card':
    case 'app_connector':
      return (
        <ActionCardContent config={config} data={data} onAction={onAction} />
      );

    // 13. Tasks List
    case 'task_kanban':
    case 'task_list':
    case 'productivity':
      return (
        <TaskListContent config={config} data={data} onAction={onAction} />
      );

    // 14. Meeting Notes
    case 'meeting_summary':
    case 'meeting_notes':
      return (
        <MeetingNotesContent config={config} data={data} onAction={onAction} />
      );

    default:
      return (
        <DefaultJsonViewer data={data} config={config} onAction={onAction} />
      );
  }
}

// ---------------------------------------------------------------------------
// Sub-components: A. Data & Visualization
// ---------------------------------------------------------------------------

function MetricCardContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const value = data?.value ?? config.value ?? '1,280';
  const label = data?.label ?? config.metricLabel ?? 'Total Conversions';
  const change = data?.change ?? config.change ?? '+14.2%';
  const isPositive = !String(change).startsWith('-');
  const unit = config.unit || '';

  return (
    <div className="py-2 space-y-4 flex h-full flex-col justify-between">
      <div>
        <div className="text-3xl font-bold tracking-tight gap-1 flex items-baseline text-foreground">
          {unit && (
            <span className="text-lg font-normal text-muted-foreground">
              {unit}
            </span>
          )}
          <span>{value}</span>
        </div>
        <p className="text-xs mt-0.5 text-muted-foreground">{label}</p>
      </div>

      <div className="text-xs pt-2 flex items-center justify-between border-t border-border/40">
        <div
          className={cn(
            'gap-1 font-medium flex items-center',
            isPositive ? 'text-success-text' : 'text-rose-500',
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <ArrowDownRight className="size-3.5" />
          )}
          <span>{change}</span>
          <span className="font-normal ml-1 text-muted-foreground">
            vs last period
          </span>
        </div>
        {config.drillDownAction && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onAction?.('drill_down', { value, label })}
            className="text-xs h-6 px-1.5 text-primary hover:underline"
          >
            Details <ExternalLink className="ml-1 size-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BarChartContent({
  config,
  data,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const chartData = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(config.data)) return config.data;
    return [
      { name: 'Mon', value: 42 },
      { name: 'Tue', value: 68 },
      { name: 'Wed', value: 85 },
      { name: 'Thu', value: 54 },
      { name: 'Fri', value: 92 },
      { name: 'Sat', value: 34 },
      { name: 'Sun', value: 76 },
    ];
  }, [data, config.data]);

  const dataKey = config.dataKey || 'value';
  const xKey = config.xKey || 'name';
  const color = config.color || '#6366f1';

  return (
    <div className="h-48 pt-2 min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            stroke="#888888"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#888888"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              borderColor: '#27272a',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartContent({
  config,
  data,
  isArea,
}: {
  config: Record<string, any>;
  data: any;
  isArea?: boolean;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const chartData = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(config.data)) return config.data;
    return [
      { date: '10/01', current: 120, prev: 90 },
      { date: '10/02', current: 150, prev: 110 },
      { date: '10/03', current: 190, prev: 140 },
      { date: '10/04', current: 240, prev: 160 },
      { date: '10/05', current: 220, prev: 180 },
      { date: '10/06', current: 290, prev: 210 },
    ];
  }, [data, config.data]);

  const xKey = config.xKey || 'date';
  const dataKey = config.dataKey || 'current';
  const color = config.color || '#8b5cf6';

  return (
    <div className="h-48 pt-2 min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {isArea ? (
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="widgetAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
              vertical={false}
            />
            <XAxis
              dataKey={xKey}
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill="url(#widgetAreaGrad)"
            />
          </AreaChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
              vertical={false}
            />
            <XAxis
              dataKey={xKey}
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function TableViewContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const rows = useMemo(() => {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(config.rows)
        ? config.rows
        : [
            {
              id: '1',
              name: 'OpenAI GPT-4o Call',
              status: 'Success',
              latency: '412ms',
              cost: '$0.012',
            },
            {
              id: '2',
              name: 'Firecrawl Scraper',
              status: 'Success',
              latency: '1,280ms',
              cost: '$0.005',
            },
            {
              id: '3',
              name: 'Slack Bot Notification',
              status: 'Pending',
              latency: '120ms',
              cost: '$0.000',
            },
            {
              id: '4',
              name: 'Vector DB Indexing',
              status: 'Success',
              latency: '650ms',
              cost: '$0.008',
            },
          ];
    if (!searchTerm) return list;
    return list.filter((r) =>
      Object.values(r).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  }, [data, config.rows, searchTerm]);

  const columns =
    config.columns ||
    (rows.length > 0
      ? Object.keys(rows[0]).filter((k) => k !== 'id')
      : ['name', 'status', 'latency']);

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        columns.join(','),
        ...rows.map((r: any) =>
          columns.map((c: string) => `"${r[c] ?? ''}"`).join(','),
        ),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.title || 'table_export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onAction?.('export_csv', { count: rows.length });
  };

  return (
    <div className="space-y-2 flex h-full flex-col">
      <div className="gap-2 flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="left-2.5 top-2.5 size-3 absolute text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search records…"
            className="h-8 pl-8 text-xs bg-surface-raised"
          />
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={handleExport}
          className="h-8 text-xs shrink-0"
        >
          <Download className="mr-1 size-3" /> Export
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto rounded-md border border-border bg-surface-raised/40">
        <table className="text-xs w-full border-collapse text-left">
          <thead>
            <tr className="font-semibold border-b border-border bg-muted/40 text-muted-foreground">
              {columns.map((col: string) => (
                <th key={col} className="p-2 text-xs capitalize">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row: any, i: number) => (
              <tr key={i} className="transition-colors hover:bg-muted/30">
                {columns.map((col: string) => (
                  <td
                    key={col}
                    className="p-2 max-w-[150px] truncate text-foreground"
                  >
                    {col === 'status' ? (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 font-medium inline-flex items-center rounded-md text-2xs',
                          String(row[col]).toLowerCase() === 'success'
                            ? 'bg-success/10 text-success-text'
                            : 'bg-amber-500/10 text-amber-500',
                        )}
                      >
                        {row[col]}
                      </span>
                    ) : (
                      String(row[col] ?? '—')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgressSummaryContent({
  config,
  data,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const items = useMemo(() => {
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(config.items)) return config.items;
    return [
      {
        label: 'Agent Tasks Completed',
        current: 84,
        total: 100,
        color: 'bg-success',
      },
      {
        label: 'Token Budget Spent',
        current: 62,
        total: 100,
        color: 'bg-indigo-500',
      },
      {
        label: 'Approvals Resolved',
        current: 95,
        total: 100,
        color: 'bg-blue-500',
      },
    ];
  }, [data, config.items]);

  return (
    <div className="space-y-4 py-2">
      {items.map((item: any, idx: number) => {
        const pct = Math.min(
          100,
          Math.round((item.current / item.total) * 100),
        );
        return (
          <div key={idx} className="space-y-1.5">
            <div className="text-xs flex items-center justify-between">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="font-mono text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  item.color || 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: B. Interactive Inputs
// ---------------------------------------------------------------------------

function FormInputContent({
  config,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const [val, setVal] = useState(config.defaultValue || '');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val) return;
    onAction?.('submit_input', { value: val });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 py-1 flex h-full flex-col justify-between"
    >
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">
          {config.inputLabel || 'Parameter Input'}
        </Label>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={config.placeholder || 'Enter value to send to agent…'}
          className="h-9 text-xs"
        />
        {config.helpText && (
          <p className="text-xs text-muted-foreground">{config.helpText}</p>
        )}
      </div>

      <div className="gap-2 pt-2 flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!val || submitted}
          className="text-xs h-8"
        >
          {submitted ? (
            <>
              <Check className="mr-1.5 size-3.5" /> Dispatched
            </>
          ) : (
            <>
              <Send className="mr-1.5 size-3.5" />{' '}
              {config.buttonLabel || 'Submit Input'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function DynamicFormContent({
  config,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const fields = config.fields || [
    {
      name: 'topic',
      label: 'Research Subject',
      type: 'text',
      placeholder: 'e.g. Q3 Competitor Analysis',
    },
    {
      name: 'depth',
      label: 'Analysis Depth',
      type: 'select',
      options: ['Brief Overview', 'In-Depth Technical', 'Executive Summary'],
    },
    { name: 'notify', label: 'Notify on Completion', type: 'checkbox' },
  ];

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (name: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onAction?.('form_submitted', formValues);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-3 py-1 text-xs">
      {fields.map((f: any) => (
        <div key={f.name} className="space-y-1">
          <Label className="font-semibold text-foreground">{f.label}</Label>
          {f.type === 'select' ? (
            <AppSelect
              value={formValues[f.name] || undefined}
              onValueChange={(v) => handleChange(f.name, v)}
              placeholder="Select option…"
              options={(f.options ?? []).map((opt: string) => ({
                value: opt,
                label: opt,
              }))}
            />
          ) : f.type === 'checkbox' ? (
            <div className="gap-2 pt-1 flex items-center">
              <Checkbox
                id={f.name}
                checked={Boolean(formValues[f.name])}
                onCheckedChange={(c) => handleChange(f.name, c === true)}
              />
              <span className="text-muted-foreground">{f.label}</span>
            </div>
          ) : (
            <Input
              value={formValues[f.name] || ''}
              onChange={(e) => handleChange(f.name, e.target.value)}
              placeholder={f.placeholder || ''}
              className="h-8 text-xs"
            />
          )}
        </div>
      ))}

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="text-xs h-8"
        >
          {loading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 size-3.5" />
          )}
          Execute Form Action
        </Button>
      </div>
    </form>
  );
}

function ApprovalFormContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(
    'pending',
  );
  const actionName =
    data?.actionName ||
    config.actionName ||
    'Deploy Marketing Campaign to Production';
  const requester =
    data?.requester || config.requester || 'AI Autonomous Agent #4';
  const details =
    data?.details ||
    config.details ||
    'This action modifies live customer email campaign states. Human confirmation is required before firing external webhooks.';

  const handleDecision = (decision: 'approved' | 'rejected') => {
    setStatus(decision);
    onAction?.('approval_decision', { decision, actionName });
  };

  if (status !== 'pending') {
    return (
      <div className="py-6 space-y-2 flex flex-col items-center justify-center text-center">
        {status === 'approved' ? (
          <CheckCircle2 className="size-8 text-success-text" />
        ) : (
          <XCircle className="size-8 text-rose-500" />
        )}
        <div className="text-sm font-semibold text-foreground capitalize">
          Action {status}
        </div>
        <p className="text-xs text-muted-foreground">
          Recorded in studio audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1 flex h-full flex-col justify-between">
      <div className="space-y-2">
        <div className="gap-1.5 text-amber-500 font-semibold text-xs flex items-center">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Requires Human Approval</span>
        </div>
        <h4 className="text-xs font-semibold text-foreground">{actionName}</h4>
        <p className="text-xs leading-relaxed p-2.5 rounded-md border border-border/50 bg-muted/30 text-muted-foreground">
          {details}
        </p>
        <div className="gap-1 pt-1 flex items-center text-2xs text-muted-foreground">
          <User className="size-3" /> Requested by{' '}
          <span className="font-medium text-foreground">{requester}</span>
        </div>
      </div>

      <div className="gap-2 pt-2 grid grid-cols-2 border-t border-border/40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDecision('rejected')}
          className="text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={() => handleDecision('approved')}
          className="text-xs h-8 bg-success text-success-foreground hover:bg-success/90"
        >
          Approve Action
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: C. AI-Powered
// ---------------------------------------------------------------------------

function AiSummaryContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const summaryText =
    data?.summary ||
    config.summary ||
    'Based on synthesized telemetry across 14 workspace agents, error rates dropped by 34% after implementing intelligent retry policies. Top latency contributor remains cold-start LLM queries.';
  const confidence = data?.confidence || config.confidence || '98%';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onAction?.('copy_summary', { length: summaryText.length });
  };

  return (
    <div className="space-y-3 py-1 flex h-full flex-col justify-between">
      <div className="space-y-2">
        <div className="text-xs flex items-center justify-between">
          <span className="gap-1.5 font-medium flex items-center text-primary">
            <Sparkles className="size-3.5" /> AI Synthesis
          </span>
          <Badge
            variant="secondary"
            className="font-mono text-2xs text-success-text"
          >
            {confidence} Confidence
          </Badge>
        </div>
        <div className="text-xs leading-relaxed p-3 rounded-lg border border-border/60 bg-surface-raised/60 text-foreground">
          {summaryText}
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-border/40">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="mr-1.5 size-3" />
          ) : (
            <Copy className="mr-1.5 size-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onAction?.('regenerate_summary')}
          className="text-xs h-7 px-2 text-primary"
        >
          <RefreshCw className="mr-1.5 size-3" /> Regenerate
        </Button>
      </div>
    </div>
  );
}

function EntityExtractorContent({
  config,
  data,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const entities = useMemo(() => {
    if (Array.isArray(data?.entities)) return data.entities;
    if (Array.isArray(config.entities)) return config.entities;
    return [
      { type: 'Organization', value: 'Onetab AI', count: 18 },
      { type: 'Location', value: 'San Francisco, CA', count: 4 },
      { type: 'Financial', value: '$240,000 USD', count: 2 },
      { type: 'Date', value: 'October 2026', count: 9 },
      { type: 'Person', value: 'Sarah Chen (Lead)', count: 6 },
    ];
  }, [data, config.entities]);

  return (
    <div className="space-y-2.5 py-1">
      <p className="text-xs text-muted-foreground">
        Discovered entities and extracted parameters:
      </p>
      <div className="gap-2 flex flex-wrap">
        {entities.map((ent: any, idx: number) => (
          <div
            key={idx}
            className="gap-1.5 px-2.5 py-1 text-xs flex items-center rounded-md border border-border bg-surface-raised"
          >
            <span className="font-mono text-2xs text-muted-foreground uppercase">
              {ent.type}:
            </span>
            <span className="font-medium text-foreground">{ent.value}</span>
            <span className="px-1.5 rounded-full bg-muted text-2xs text-muted-foreground">
              {ent.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentContent({
  config,
  data,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const sentiment = data?.sentiment ||
    config.sentiment || {
      score: 82,
      verdict: 'Positive',
      breakdown: { positive: 75, neutral: 18, negative: 7 },
    };

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Tone Analysis</span>
        <Badge
          variant="secondary"
          className="font-medium text-xs text-success-text"
        >
          {sentiment.verdict} ({sentiment.score}%)
        </Badge>
      </div>

      <div className="h-3 flex w-full overflow-hidden rounded-full bg-muted">
        <div
          style={{ width: `${sentiment.breakdown.positive}%` }}
          className="bg-success"
          title="Positive"
        />
        <div
          style={{ width: `${sentiment.breakdown.neutral}%` }}
          className="bg-amber-500"
          title="Neutral"
        />
        <div
          style={{ width: `${sentiment.breakdown.negative}%` }}
          className="bg-rose-500"
          title="Negative"
        />
      </div>

      <div className="text-xs pt-1 flex justify-between text-muted-foreground">
        <span className="gap-1 flex items-center">
          <span className="size-2 inline-block rounded-full bg-success" />{' '}
          Positive {sentiment.breakdown.positive}%
        </span>
        <span className="gap-1 flex items-center">
          <span className="size-2 bg-amber-500 inline-block rounded-full" />{' '}
          Neutral {sentiment.breakdown.neutral}%
        </span>
        <span className="gap-1 flex items-center">
          <span className="size-2 bg-rose-500 inline-block rounded-full" />{' '}
          Negative {sentiment.breakdown.negative}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: D. App Connectors & E. Productivity
// ---------------------------------------------------------------------------

function ActionCardContent({
  config,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const connectorName = config.connectorName || 'Slack';
  const actionTitle = config.actionTitle || 'Send Team Alert Broadcast';

  const handleExecute = async () => {
    setLoading(true);
    try {
      await onAction?.('execute_connector_action', {
        connector: connectorName,
        action: actionTitle,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 py-1 flex h-full flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className="border-brand/30 text-2xs text-brand-text"
          >
            {connectorName}
          </Badge>
          <span className="gap-1 font-medium inline-flex items-center text-2xs text-success-text">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />{' '}
            Connected
          </span>
        </div>
        <h4 className="text-xs font-semibold text-foreground">{actionTitle}</h4>
        <p className="text-xs text-muted-foreground">
          {config.description ||
            'Triggers immediate outbound sync via workspace connector credentials.'}
        </p>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={handleExecute}
          disabled={loading}
          className="text-xs h-8"
        >
          {loading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Zap className="mr-1.5 size-3.5" />
          )}
          Trigger Now
        </Button>
      </div>
    </div>
  );
}

function TaskListContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const [tasks, setTasks] = useState(() => {
    if (Array.isArray(data?.tasks)) return data.tasks;
    if (Array.isArray(config.tasks)) return config.tasks;
    return [
      { id: '1', title: 'Verify Firecrawl Rate Limiters', done: true },
      { id: '2', title: 'Review Autonomous Prompt Changes', done: false },
      { id: '3', title: 'Export Weekly Observability Metrics', done: false },
    ];
  });

  const toggleTask = (id: string) => {
    setTasks((prev: any[]) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    onAction?.('toggle_task', { id });
  };

  return (
    <div className="space-y-2 py-1">
      {tasks.map((task: any) => (
        <div
          key={task.id}
          onClick={() => toggleTask(task.id)}
          className="gap-2.5 p-2 text-xs flex cursor-pointer items-center rounded-md border border-border/60 bg-surface-raised/40 transition-colors hover:bg-surface-raised"
        >
          <div
            className={cn(
              'size-4 flex items-center justify-center rounded-md border transition-colors',
              task.done
                ? 'border-foreground bg-foreground text-background'
                : 'border-muted-foreground',
            )}
          >
            {task.done && <Check className="size-3" />}
          </div>
          <span
            className={cn(
              'flex-1 text-foreground',
              task.done && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}

function MeetingNotesContent({
  config,
  data,
  onAction,
}: {
  config: Record<string, any>;
  data: any;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const title =
    data?.title || config.meetingTitle || 'Sprint Orchestration & AI Review';
  const notes = data?.notes ||
    config.notes || [
      'Autonomous agents completed 98.4% of scheduled triggers without manual intervention.',
      'Identified 2 unhandled tool timeouts in external CRM connector.',
      'Scheduled prompt optimizer run for next Tuesday.',
    ];

  return (
    <div className="space-y-3 py-1 text-xs flex h-full flex-col justify-between">
      <div className="space-y-2">
        <div className="font-semibold gap-1.5 flex items-center text-foreground">
          <FileText className="size-3.5 text-primary" /> {title}
        </div>
        <ul className="space-y-1.5 leading-relaxed text-xs list-inside list-disc text-muted-foreground">
          {notes.map((note: string, idx: number) => (
            <li key={idx}>
              <span className="text-foreground">{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          variant="outline"
          size="xs"
          onClick={() => onAction?.('export_notes', { title, notes })}
          className="text-xs h-7"
        >
          <Download className="mr-1.5 size-3" /> Save to Docs
        </Button>
      </div>
    </div>
  );
}

function DefaultJsonViewer({
  data,
  config,
}: {
  data: any;
  config: Record<string, any>;
  onAction?: (actionName: string, payload?: any) => void;
}) {
  const displayVal = data !== undefined ? data : config;
  return (
    <div className="flex h-full flex-col justify-center">
      <pre className="text-xs bg-zinc-950 p-3 max-h-48 overflow-x-auto rounded-md border border-border/60 font-mono text-muted-foreground">
        {JSON.stringify(displayVal, null, 2)}
      </pre>
    </div>
  );
}
