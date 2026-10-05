import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Loader2,
  MoreVertical,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminOverviewAnalytics } from '../use-admin-analytics.js';
import { AdminMetricCard } from '../components/AdminMetricCard.js';

// ============================================================================
// Types
// ============================================================================

export type TimeRangeOption = '3m' | '30d' | '7d';

export interface SectionRow {
  id: string;
  header: string;
  sectionType: string;
  status: 'In Process' | 'Done' | 'Pending' | 'Review';
  target: number;
  limit: number;
  reviewer: {
    name: string;
    initials: string;
  };
  tab: 'outline' | 'past_performance' | 'key_personnel' | 'focus';
}

// Initial sample items matching the exact reference image
const INITIAL_SECTION_ROWS: SectionRow[] = [
  {
    id: 'sec-1',
    header: 'Cover page',
    sectionType: 'Cover page',
    status: 'In Process',
    target: 18,
    limit: 5,
    reviewer: { name: 'Eddie Lake', initials: 'EL' },
    tab: 'outline',
  },
  {
    id: 'sec-2',
    header: 'Table of contents',
    sectionType: 'Table of contents',
    status: 'Done',
    target: 29,
    limit: 24,
    reviewer: { name: 'Eddie Lake', initials: 'EL' },
    tab: 'outline',
  },
  {
    id: 'sec-3',
    header: 'Executive summary',
    sectionType: 'Narrative',
    status: 'Done',
    target: 10,
    limit: 13,
    reviewer: { name: 'Eddie Lake', initials: 'EL' },
    tab: 'outline',
  },
  {
    id: 'sec-4',
    header: 'Technical architecture & cloud topology',
    sectionType: 'Technical',
    status: 'In Process',
    target: 45,
    limit: 12,
    reviewer: { name: 'Sarah Chen', initials: 'SC' },
    tab: 'past_performance',
  },
  {
    id: 'sec-5',
    header: 'Historical SLA benchmarks & reliability',
    sectionType: 'Operations',
    status: 'Done',
    target: 32,
    limit: 28,
    reviewer: { name: 'Marcus Vance', initials: 'MV' },
    tab: 'past_performance',
  },
  {
    id: 'sec-6',
    header: 'Quarterly compliance audit ledger',
    sectionType: 'Security',
    status: 'Done',
    target: 50,
    limit: 48,
    reviewer: { name: 'Elena Rostova', initials: 'ER' },
    tab: 'past_performance',
  },
  {
    id: 'sec-7',
    header: 'Principal systems architect credentials',
    sectionType: 'Personnel',
    status: 'Done',
    target: 20,
    limit: 15,
    reviewer: { name: 'Eddie Lake', initials: 'EL' },
    tab: 'key_personnel',
  },
  {
    id: 'sec-8',
    header: 'Platform security officer certifications',
    sectionType: 'Security',
    status: 'In Process',
    target: 25,
    limit: 18,
    reviewer: { name: 'Sarah Chen', initials: 'SC' },
    tab: 'key_personnel',
  },
  {
    id: 'sec-9',
    header: 'Commercial licensing & master terms',
    sectionType: 'Commercial',
    status: 'Pending',
    target: 15,
    limit: 10,
    reviewer: { name: 'Marcus Vance', initials: 'MV' },
    tab: 'focus',
  },
];

// Reference chart data points (approx. 20-25 date points matching undulating curves)
const GENERATED_VISITOR_DATA_3M = [
  { date: 'Apr 2', organic: 120, direct: 80, desktop: 40 },
  { date: 'Apr 6', organic: 180, direct: 110, desktop: 60 },
  { date: 'Apr 10', organic: 290, direct: 160, desktop: 90 },
  { date: 'Apr 14', organic: 240, direct: 140, desktop: 75 },
  { date: 'Apr 18', organic: 380, direct: 220, desktop: 120 },
  { date: 'Apr 23', organic: 310, direct: 180, desktop: 100 },
  { date: 'Apr 28', organic: 450, direct: 260, desktop: 140 },
  { date: 'May 3', organic: 390, direct: 210, desktop: 110 },
  { date: 'May 7', organic: 520, direct: 310, desktop: 170 },
  { date: 'May 12', organic: 360, direct: 200, desktop: 110 },
  { date: 'May 17', organic: 580, direct: 350, desktop: 190 },
  { date: 'May 22', organic: 320, direct: 190, desktop: 95 },
  { date: 'May 27', organic: 490, direct: 280, desktop: 150 },
  { date: 'Jun 1', organic: 340, direct: 180, desktop: 90 },
  { date: 'Jun 5', organic: 460, direct: 270, desktop: 140 },
  { date: 'Jun 9', organic: 330, direct: 170, desktop: 90 },
  { date: 'Jun 14', organic: 510, direct: 290, desktop: 160 },
  { date: 'Jun 19', organic: 370, direct: 210, desktop: 110 },
  { date: 'Jun 24', organic: 540, direct: 320, desktop: 175 },
  { date: 'Jun 30', organic: 430, direct: 250, desktop: 130 },
];

const GENERATED_VISITOR_DATA_30D = [
  { date: 'Jun 1', organic: 340, direct: 180, desktop: 90 },
  { date: 'Jun 4', organic: 410, direct: 240, desktop: 120 },
  { date: 'Jun 7', organic: 320, direct: 180, desktop: 95 },
  { date: 'Jun 10', organic: 460, direct: 270, desktop: 140 },
  { date: 'Jun 13', organic: 380, direct: 210, desktop: 110 },
  { date: 'Jun 16', organic: 520, direct: 310, desktop: 170 },
  { date: 'Jun 19', organic: 370, direct: 210, desktop: 110 },
  { date: 'Jun 22', organic: 480, direct: 280, desktop: 150 },
  { date: 'Jun 25', organic: 540, direct: 320, desktop: 175 },
  { date: 'Jun 28', organic: 470, direct: 270, desktop: 145 },
  { date: 'Jun 30', organic: 430, direct: 250, desktop: 130 },
];

const GENERATED_VISITOR_DATA_7D = [
  { date: 'Jun 24', organic: 540, direct: 320, desktop: 175 },
  { date: 'Jun 25', organic: 510, direct: 300, desktop: 165 },
  { date: 'Jun 26', organic: 480, direct: 280, desktop: 150 },
  { date: 'Jun 27', organic: 520, direct: 310, desktop: 170 },
  { date: 'Jun 28', organic: 470, direct: 270, desktop: 145 },
  { date: 'Jun 29', organic: 490, direct: 290, desktop: 155 },
  { date: 'Jun 30', organic: 430, direct: 250, desktop: 130 },
];

// ============================================================================
// Subcomponents
// ============================================================================

// ============================================================================
// Reference Layout Widgets: Cluster Load & Active Lanes
// ============================================================================

const CLUSTER_NODES = [
  { id: 'N00', load: 45, status: 'normal' },
  { id: 'N01', load: 38, status: 'normal' },
  { id: 'N02', load: 52, status: 'normal' },
  { id: 'N03', load: 24, status: 'normal' },
  { id: 'N04', load: 60, status: 'normal' },
  { id: 'N05', load: 48, status: 'normal' },
  { id: 'N06', load: 32, status: 'normal' },
  { id: 'N07', load: 66, status: 'normal' },
  { id: 'N08', load: 55, status: 'normal' },
  { id: 'N09', load: 42, status: 'normal' },
  { id: 'N10', load: 39, status: 'normal' },
  { id: 'N11', load: 58, status: 'normal' },
  { id: 'N12', load: 64, status: 'normal' },
  { id: 'N13', load: 47, status: 'normal' },
  { id: 'N14', load: 92, status: 'critical' },
  { id: 'N15', load: 50, status: 'normal' },
  { id: 'N16', load: 36, status: 'normal' },
  { id: 'N17', load: 40, status: 'normal' },
  { id: 'N18', load: 56, status: 'normal' },
  { id: 'N19', load: 33, status: 'normal' },
  { id: 'N20', load: 44, status: 'normal' },
  { id: 'N21', load: 59, status: 'normal' },
  { id: 'N22', load: 63, status: 'normal' },
  { id: 'N23', load: 51, status: 'normal' },
  { id: 'N24', load: 72, status: 'normal' },
  { id: 'N25', load: 68, status: 'normal' },
  { id: 'N26', load: 78, status: 'normal' },
  { id: 'N27', load: 95, status: 'critical' },
  { id: 'N28', load: 62, status: 'normal' },
  { id: 'N29', load: 88, status: 'warm' },
  { id: 'N30', load: 54, status: 'normal' },
  { id: 'N31', load: 46, status: 'normal' },
  { id: 'N32', load: 70, status: 'normal' },
  { id: 'N33', load: 84, status: 'warm' },
  { id: 'N34', load: 53, status: 'normal' },
  { id: 'N35', load: 41, status: 'normal' },
  { id: 'N36', load: 65, status: 'normal' },
  { id: 'N37', load: 58, status: 'normal' },
  { id: 'N38', load: 49, status: 'normal' },
  { id: 'N39', load: 37, status: 'normal' },
  { id: 'N40', load: 44, status: 'normal' },
  { id: 'N41', load: 62, status: 'normal' },
  { id: 'N42', load: 28, status: 'normal' },
  { id: 'N43', load: 50, status: 'normal' },
  { id: 'N44', load: 35, status: 'normal' },
  { id: 'N45', load: 57, status: 'normal' },
  { id: 'N46', load: 66, status: 'normal' },
  { id: 'N47', load: 48, status: 'normal' },
  { id: 'N48', load: 39, status: 'normal' },
  { id: 'N49', load: 52, status: 'normal' },
  { id: 'N50', load: 61, status: 'normal' },
  { id: 'N51', load: 55, status: 'normal' },
];

function ClusterLoadCard() {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
            Cluster Load
          </h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
              Normal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              Warm
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              Critical
            </span>
          </div>
        </div>

        {/* Right Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-xs font-semibold text-foreground">
            52 Nodes
          </span>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            2 Warm
          </span>
          <span className="rounded-full border border-rose-500/25 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            2 Critical
          </span>
        </div>
      </div>

      {/* 52 Vertical Bars */}
      <div className="pt-4 pb-2">
        <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-36 w-full px-1">
          {CLUSTER_NODES.map((node) => {
            const barBg =
              node.status === 'critical'
                ? 'bg-rose-500'
                : node.status === 'warm'
                ? 'bg-amber-500'
                : 'bg-zinc-400 dark:bg-zinc-700/80 hover:bg-zinc-300 dark:hover:bg-zinc-500';

            return (
              <div
                key={node.id}
                title={`${node.id}: ${node.load}% load (${node.status})`}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                <div
                  style={{ height: `${node.load}%` }}
                  className={cn(
                    'w-full rounded-t-xs transition-all duration-200',
                    barBg,
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Axis ticks */}
        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground/60 pt-2 px-1">
          <span>N00</span>
          <span>N26</span>
          <span>N51</span>
        </div>
      </div>
    </Card>
  );
}

const ACTIVE_LANES = [
  {
    id: '00',
    title: '[00] API Flood',
    sub: 'Edge WAF • Mitigating',
    count: '4,521',
    pct: 92,
    color: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  {
    id: '01',
    title: '[01] Mail Spoof',
    sub: 'Mail Relay • Reviewing',
    count: '3,102',
    pct: 64,
    color: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  {
    id: '02',
    title: '[02] Cloud Probe',
    sub: 'Cloud API • Queued',
    count: '1,250',
    pct: 26,
    color: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
  {
    id: '03',
    title: '[03] Mesh Beacon',
    sub: 'Int Node • Watching',
    count: '420',
    pct: 9,
    color: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
];

function ActiveLanesCard() {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
          Active Lanes
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Threat Queue</p>
      </div>

      {/* Lanes List */}
      <div className="space-y-4 pt-4">
        {ACTIVE_LANES.map((lane) => (
          <div key={lane.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('size-2 rounded-full shrink-0', lane.dot)} />
                <span className="text-xs font-semibold text-foreground truncate">
                  {lane.title}
                </span>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  • {lane.sub}
                </span>
              </div>
              <span className="text-xs font-bold text-foreground font-mono tabular-nums">
                {lane.count}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden">
                <div
                  style={{ width: `${lane.pct}%` }}
                  className={cn('h-full rounded-full transition-all duration-500', lane.color)}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">
                {lane.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Custom Tooltip for the Visitors Chart
 */
function VisitorsChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 p-3 text-popover-foreground shadow-lg backdrop-blur-md text-xs min-w-[150px] space-y-1.5">
      <div className="font-semibold text-foreground border-b border-border/50 pb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{total} total</span>
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize">{entry.dataKey}</span>
            </div>
            <span className="font-mono font-medium text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Add Section Dialog
 */
function AddSectionModal({
  open,
  onOpenChange,
  onAddSection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSection: (section: Omit<SectionRow, 'id'>) => void;
}) {
  const [header, setHeader] = useState('');
  const [sectionType, setSectionType] = useState('Narrative');
  const [status, setStatus] = useState<SectionRow['status']>('In Process');
  const [target, setTarget] = useState('20');
  const [limit, setLimit] = useState('10');
  const [reviewerName, setReviewerName] = useState('Eddie Lake');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!header.trim()) return;

    const initials = reviewerName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    onAddSection({
      header: header.trim(),
      sectionType,
      status,
      target: Number(target) || 0,
      limit: Number(limit) || 0,
      reviewer: { name: reviewerName, initials: initials || 'AD' },
      tab: 'outline',
    });

    setHeader('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Section</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new document section or governance gate to the outline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Header Title</label>
              <Input
                placeholder="e.g. System architecture overview"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Section Type</label>
                <Input
                  value={sectionType}
                  onChange={(e) => setSectionType(e.target.value)}
                  placeholder="e.g. Technical"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SectionRow['status'])}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                >
                  <option value="In Process">In Process</option>
                  <option value="Done">Done</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Reviewer</label>
                <Input
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Target</label>
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Limit</label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!header.trim()}>
              Add Section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main OverviewDashboardView Component
// ============================================================================

export function OverviewDashboardView() {
  const gradientPrefix = useId().replace(/:/g, '');

  // Backend overview integration
  const { data: overview, isLoading } = useAdminOverviewAnalytics();

  // Time range for visitors chart
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('3m');

  // Chart data according to selected timeframe
  const chartData = useMemo(() => {
    switch (timeRange) {
      case '7d':
        return GENERATED_VISITOR_DATA_7D;
      case '30d':
        return GENERATED_VISITOR_DATA_30D;
      case '3m':
      default:
        return GENERATED_VISITOR_DATA_3M;
    }
  }, [timeRange]);

  const timeRangeSubtitle = useMemo(() => {
    switch (timeRange) {
      case '7d':
        return 'Total for the last 7 days';
      case '30d':
        return 'Total for the last 30 days';
      case '3m':
      default:
        return 'Total for the last 3 months';
    }
  }, [timeRange]);

  // Data table state
  const [activeTab, setActiveTab] = useState<
    'outline' | 'past_performance' | 'key_personnel' | 'focus'
  >('outline');

  const [sections, setSections] = useState<SectionRow[]>(INITIAL_SECTION_ROWS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    header: true,
    sectionType: true,
    status: true,
    target: true,
    limit: true,
    reviewer: true,
  });

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtered rows for current active tab
  const displayedRows = useMemo(() => {
    if (activeTab === 'outline') {
      return sections;
    }
    return sections.filter((s) => s.tab === activeTab);
  }, [sections, activeTab]);

  // Tab counts
  const pastPerformanceCount = useMemo(
    () => sections.filter((s) => s.tab === 'past_performance').length,
    [sections],
  );
  const keyPersonnelCount = useMemo(
    () => sections.filter((s) => s.tab === 'key_personnel').length,
    [sections],
  );

  // Select all logic
  const allCurrentSelected =
    displayedRows.length > 0 &&
    displayedRows.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedRows.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddSection = (newSec: Omit<SectionRow, 'id'>) => {
    const id = `sec-${Date.now()}`;
    setSections((prev) => [
      ...prev,
      {
        ...newSec,
        id,
      },
    ]);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleStatus = (id: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          status: s.status === 'Done' ? 'In Process' : 'Done',
        };
      }),
    );
  };

  // Values from live overview with fallback to match reference image
  const totalRevenue = overview?.revenueKpis?.['mrr']?.value
    ? `$${Number(overview.revenueKpis['mrr'].value).toLocaleString()}.00`
    : '$1,250.00';

  const newCustomers = overview?.platformKpis?.['newUsers']?.value
    ? Number(overview.platformKpis['newUsers'].value).toLocaleString()
    : '1,234';

  const activeAccounts = overview?.platformKpis?.['activeUsers']?.value
    ? Number(overview.platformKpis['activeUsers'].value).toLocaleString()
    : '45,678';

  const growthRate = overview?.platformKpis?.['growthRate']?.value
    ? `${overview.platformKpis['growthRate'].value}%`
    : '4.5%';

  return (
    <div className="space-y-6 pb-12">
      {/* ====================================================================
          ROW 1: 4 Metric KPI Cards (Ref Image Layout)
          ==================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <AdminMetricCard
          label="Total Revenue"
          subtitle="MRR & Platform Billings"
          badgeText="+12.5%"
          badgeType="positive"
          value={totalRevenue}
          secondaryText="5 cases"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        {/* Card 2: New Customers */}
        <AdminMetricCard
          label="New Customers"
          subtitle="Acquisition Volume"
          badgeText="-20%"
          badgeType="negative"
          value={newCustomers}
          secondaryText="Acquisition needs attention"
          sparklineColor="rose"
          isLoading={isLoading}
        />

        {/* Card 3: Active Accounts */}
        <AdminMetricCard
          label="Active Accounts"
          subtitle="Platform Concurrency"
          badgeText="+12.5%"
          badgeType="positive"
          value={activeAccounts}
          secondaryText="Strong user retention"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        {/* Card 4: Growth Rate */}
        <AdminMetricCard
          label="Growth Rate"
          subtitle="Expansion Benchmark"
          badgeText="+4.5%"
          badgeType="positive"
          value={growthRate}
          secondaryText="Steady performance increase"
          sparklineColor="cyan"
          isLoading={isLoading}
        />
      </section>

      {/* ====================================================================
          ROW 2: Large Chart Card ("Total Visitors" - Multi-layer Area Curves)
          ==================================================================== */}
      <Card className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-2xs">
        {/* Card Header: Title/Subtitle on Left, Time Tabs on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/40">
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Total Visitors
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timeRangeSubtitle}
            </p>
          </div>

          {/* Segmented Control Buttons */}
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimeRange('3m')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                timeRange === '3m'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Last 3 months
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                timeRange === '30d'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                timeRange === '7d'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Last 7 days
            </button>
          </div>
        </div>

        {/* Multi-layer Area Chart Body */}
        <div className="pt-4 h-[260px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                {/* Layer 1: Dark Top Stream Gradient */}
                <linearGradient
                  id={`${gradientPrefix}-layer1`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0.03} />
                </linearGradient>

                {/* Layer 2: Medium Stream Gradient */}
                <linearGradient
                  id={`${gradientPrefix}-layer2`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
                </linearGradient>

                {/* Layer 3: Base Stream Gradient */}
                <linearGradient
                  id={`${gradientPrefix}-layer3`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="var(--border)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--border)" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.35}
              />

              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
                minTickGap={20}
              />

              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dx={-4}
                tickFormatter={(val) => `${val}`}
              />

              <Tooltip content={<VisitorsChartTooltip />} />

              {/* Area 1: Organic / Total layer */}
              <Area
                type="monotone"
                dataKey="organic"
                name="Organic"
                stroke="var(--foreground)"
                strokeWidth={1.75}
                fill={`url(#${gradientPrefix}-layer1)`}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--background)' }}
              />

              {/* Area 2: Direct / Web layer */}
              <Area
                type="monotone"
                dataKey="direct"
                name="Direct"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                fill={`url(#${gradientPrefix}-layer2)`}
                activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--background)' }}
              />

              {/* Area 3: Desktop / App layer */}
              <Area
                type="monotone"
                dataKey="desktop"
                name="Desktop"
                stroke="var(--border-strong, #888)"
                strokeWidth={1.25}
                fill={`url(#${gradientPrefix}-layer3)`}
                activeDot={{ r: 3.5, strokeWidth: 1, stroke: 'var(--background)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ====================================================================
          ROW 3: Cluster Load & Active Lanes (Ref Image Exact Widgets)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClusterLoadCard />
        </div>
        <div>
          <ActiveLanesCard />
        </div>
      </div>

      {/* ====================================================================
          ROW 4: Rich Data Table Card ("Outline" / Document & Platform Sections)
          ==================================================================== */}
      <Card className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
        {/* Table Card Header Toolbar: Left Tabs, Right Action Buttons */}
        <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/40">
          {/* Left Pill Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('outline')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeTab === 'outline'
                  ? 'bg-accent text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              Outline
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('past_performance')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                activeTab === 'past_performance'
                  ? 'bg-accent text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <span>Past Performance</span>
              <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {pastPerformanceCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('key_personnel')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                activeTab === 'key_personnel'
                  ? 'bg-accent text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <span>Key Personnel</span>
              <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {keyPersonnelCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('focus')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeTab === 'focus'
                  ? 'bg-accent text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              Focus Documents
            </button>
          </div>

          {/* Right Action Buttons: Customize Columns, + Add Section */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Customize Columns Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Customize Columns</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-3 space-y-2">
                <div className="text-xs font-semibold text-foreground mb-1">
                  Visible Columns
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.header}
                      onCheckedChange={() => toggleColumn('header')}
                    />
                    <span>Header</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.sectionType}
                      onCheckedChange={() => toggleColumn('sectionType')}
                    />
                    <span>Section Type</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.status}
                      onCheckedChange={() => toggleColumn('status')}
                    />
                    <span>Status</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.target}
                      onCheckedChange={() => toggleColumn('target')}
                    />
                    <span>Target</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.limit}
                      onCheckedChange={() => toggleColumn('limit')}
                    />
                    <span>Limit</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={visibleColumns.reviewer}
                      onCheckedChange={() => toggleColumn('reviewer')}
                    />
                    <span>Reviewer</span>
                  </label>
                </div>
              </PopoverContent>
            </Popover>

            {/* + Add Section Button */}
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" />
              <span>Add Section</span>
            </Button>
          </div>
        </div>

        {/* Selected count info banner if any selected */}
        {selectedIds.size > 0 && (
          <div className="bg-accent/40 px-4 py-2 text-xs text-foreground flex items-center justify-between border-b border-border/40">
            <span>
              {selectedIds.size} of {displayedRows.length} item(s) selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                setSections((prev) => prev.filter((s) => !selectedIds.has(s.id)));
                setSelectedIds(new Set());
              }}
            >
              Delete selected
            </Button>
          </div>
        )}

        {/* Interactive Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead className="bg-muted/30 border-b border-border/40 text-muted-foreground font-medium">
              <tr>
                {/* Select All Checkbox Column */}
                <th className="py-2.5 px-3 w-10 text-center">
                  <Checkbox
                    checked={allCurrentSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>

                {/* Header Title */}
                {visibleColumns.header && (
                  <th className="py-2.5 px-3 min-w-[200px]">Header</th>
                )}

                {/* Section Type */}
                {visibleColumns.sectionType && (
                  <th className="py-2.5 px-3 min-w-[130px]">Section Type</th>
                )}

                {/* Status */}
                {visibleColumns.status && (
                  <th className="py-2.5 px-3 min-w-[120px]">Status</th>
                )}

                {/* Target */}
                {visibleColumns.target && (
                  <th className="py-2.5 px-3 w-20 text-right">Target</th>
                )}

                {/* Limit */}
                {visibleColumns.limit && (
                  <th className="py-2.5 px-3 w-20 text-right">Limit</th>
                )}

                {/* Reviewer */}
                {visibleColumns.reviewer && (
                  <th className="py-2.5 px-3 min-w-[140px]">Reviewer</th>
                )}

                {/* Row actions */}
                <th className="py-2.5 px-3 w-12 text-center"></th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No sections in this category. Click &quot;+ Add Section&quot; to
                    create one.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isDone = row.status === 'Done';
                  const isInProcess = row.status === 'In Process';

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'hover:bg-accent/40 transition-colors group',
                        isSelected && 'bg-accent/30',
                      )}
                    >
                      {/* Checkbox column with drag handle icon */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <GripVertical className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing shrink-0" />
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(row.id)}
                            aria-label={`Select row ${row.header}`}
                          />
                        </div>
                      </td>

                      {/* Header Title */}
                      {visibleColumns.header && (
                        <td className="py-3 px-3 font-medium text-foreground">
                          {row.header}
                        </td>
                      )}

                      {/* Section Type Badge */}
                      {visibleColumns.sectionType && (
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border/80 bg-muted/40 text-[11px] font-medium text-foreground">
                            {row.sectionType}
                          </span>
                        </td>
                      )}

                      {/* Status Pill (with Done or In Process icon) */}
                      {visibleColumns.status && (
                        <td className="py-3 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
                              isDone
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : isInProcess
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-muted text-muted-foreground border border-border',
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="size-3 shrink-0" />
                            ) : isInProcess ? (
                              <Clock className="size-3 shrink-0" />
                            ) : (
                              <Loader2 className="size-3 shrink-0" />
                            )}
                            <span>{row.status}</span>
                          </span>
                        </td>
                      )}

                      {/* Target */}
                      {visibleColumns.target && (
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                          {row.target}
                        </td>
                      )}

                      {/* Limit */}
                      {visibleColumns.limit && (
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                          {row.limit}
                        </td>
                      )}

                      {/* Reviewer with Avatar */}
                      {visibleColumns.reviewer && (
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-5 rounded-full border border-border/60">
                              <AvatarFallback className="text-[9px] font-semibold bg-muted text-foreground">
                                {row.reviewer.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-foreground truncate">
                              {row.reviewer.name}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Row Actions Menu */}
                      <td className="py-3 px-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                            >
                              <MoreVertical className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(row.id)}
                              className="gap-2"
                            >
                              <Check className="size-3.5 text-muted-foreground" />
                              <span>Toggle Status</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteSection(row.id)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer matching reference design */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">1</span> to{' '}
            <span className="font-semibold text-foreground">{displayedRows.length}</span> of{' '}
            <span className="font-semibold text-foreground">{displayedRows.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              disabled
              aria-label="Previous page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 text-muted-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 font-medium text-muted-foreground">
              Page 1 of 1
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled
              aria-label="Next page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 text-muted-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Section Modal Dialog */}
      <AddSectionModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddSection={handleAddSection}
      />
    </div>
  );
}

export default OverviewDashboardView;
