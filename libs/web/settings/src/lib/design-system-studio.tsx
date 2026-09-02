import {
  ACCENTS,
  DENSITIES,
  RADII,
  useTheme,
  type Accent,
  type Density,
  type RadiusPreset,
} from '@org/design-system';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AIAgentCard,
  AICitationViewer,
  AIExecutionTimeline,
  AIModelSelector,
  AIThinkingState,
  AIUsageWidget,
  AppSelect,
  Badge,
  BlockRenderer,
  Button,
  ButtonGroup,
  Checkbox,
  Combobox,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DataGrid,
  Drawer,
  DrawerFooter,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  FilterBuilder,
  IconButton,
  Input,
  InputGroup,
  KanbanBoard,
  KanbanCardHoverCard,
  Kbd,
  KbdShortcut,
  ProjectHoverCard,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  ToggleGroup,
  ToggleGroupItem,
  TreeView,
  UniversalCard,
  UserHoverCard,
  ChannelHoverCard,
  type DataGridColumn,
  type KanbanColumn,
  type TimelineItem,
  type TreeNode,
  type UniversalCardConfig,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Archive,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Layers,
  Layout,
  Moon,
  Palette,
  Pencil,
  Play,
  Search,
  Settings,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';

export function DesignSystemStudio() {
  const {
    theme,
    density,
    accent,
    radius,
    setTheme,
    setDensity,
    setAccent,
    setRadius,
  } = useTheme();


  const [activeTab, setActiveTab] = useState('foundations');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Dropdown & select showcase state
  const [menuDensity, setMenuDensity] = useState('comfortable');
  const [menuAutosave, setMenuAutosave] = useState(true);
  const [statusValue, setStatusValue] = useState('in_progress');
  const [assigneeValue, setAssigneeValue] = useState('');
  const statusOptions = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'in_review', label: 'In review' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled', disabled: true },
  ];
  const memberOptions = [
    { value: 'u-ada', label: 'Ada Lovelace' },
    { value: 'u-alan', label: 'Alan Turing' },
    { value: 'u-grace', label: 'Grace Hopper' },
    { value: 'u-katherine', label: 'Katherine Johnson' },
    { value: 'u-long', label: 'A teammate with an unusually long display name that should truncate' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  // Mock data for DataGrid
  interface UserAgentRecord {
    id: string;
    name: string;
    model: string;
    category: string;
    status: 'active' | 'draft' | 'archived';
    executions: number;
    latency: string;
    successRate: number;
  }

  const mockDataGridRecords: UserAgentRecord[] = [
    { id: 'ag-1', name: 'Market Intelligence Agent', model: 'Claude 3.7 Sonnet', category: 'Research', status: 'active', executions: 1420, latency: '420ms', successRate: 99.2 },
    { id: 'ag-2', name: 'Code Review Copilot', model: 'GPT-4o', category: 'Engineering', status: 'active', executions: 8930, latency: '310ms', successRate: 98.7 },
    { id: 'ag-3', name: 'SQL Query Optimizer', model: 'DeepSeek R1', category: 'Database', status: 'active', executions: 540, latency: '820ms', successRate: 97.5 },
    { id: 'ag-4', name: 'Customer Support Triager', model: 'Gemini 2.0 Flash', category: 'Support', status: 'draft', executions: 120, latency: '190ms', successRate: 95.0 },
    { id: 'ag-5', name: 'Doc Synthesis & Summary', model: 'GPT-4o mini', category: 'Knowledge', status: 'archived', executions: 3410, latency: '240ms', successRate: 99.8 },
  ];

  const dataGridColumns: DataGridColumn<UserAgentRecord>[] = [
    {
      id: 'name',
      header: 'Agent Name',
      accessorKey: 'name',
      sortable: true,
      editable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Bot className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      id: 'model',
      header: 'Model',
      accessorKey: 'model',
      sortable: true,
      cell: (row) => <Badge variant="secondary" className="font-mono text-[10px]">{row.model}</Badge>,
    },
    {
      id: 'category',
      header: 'Category',
      accessorKey: 'category',
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-xs px-1.5 py-0.2 text-[10px] font-medium border',
            row.status === 'active' && 'bg-success/10 text-success-text border-success/20',
            row.status === 'draft' && 'bg-warning/10 text-warning-text border-warning/20',
            row.status === 'archived' && 'bg-muted text-muted-foreground border-border',
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'executions',
      header: 'Runs',
      accessorKey: 'executions',
      sortable: true,
      align: 'right',
      cell: (row) => <span className="font-mono">{row.executions.toLocaleString()}</span>,
    },
    {
      id: 'latency',
      header: 'Avg Latency',
      accessorKey: 'latency',
      sortable: true,
      align: 'right',
      cell: (row) => <span className="font-mono text-muted-foreground">{row.latency}</span>,
    },
    {
      id: 'successRate',
      header: 'Success',
      accessorKey: 'successRate',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-mono font-medium text-success-text">{row.successRate}%</span>
      ),
    },
  ];

  // Mock Kanban columns
  const mockKanbanCols: KanbanColumn[] = [
    {
      id: 'col-todo',
      title: 'Backlog',
      accentColor: 'var(--muted-foreground)',
      cards: [
        { id: 'c-1', title: 'Implement Vector Indexing in Postgres', priority: 'high', tags: ['DB', 'AI'], dueDate: 'Tomorrow', subtasksCompleted: 2, subtasksTotal: 4, assignee: { name: 'Sarah Chen' } },
        { id: 'c-2', title: 'Add MCP tools for Github and Jira', priority: 'medium', tags: ['Integrations'], assignee: { name: 'Alex Rivera' } },
      ],
    },
    {
      id: 'col-progress',
      title: 'In Progress',
      accentColor: 'var(--primary)',
      cards: [
        { id: 'c-3', title: 'Design System Tokens & Density Engine', priority: 'urgent', tags: ['UI', 'DX'], subtasksCompleted: 4, subtasksTotal: 4, assignee: { name: 'Antigravity' } },
      ],
    },
    {
      id: 'col-done',
      title: 'Completed',
      accentColor: 'var(--success)',
      cards: [
        { id: 'c-4', title: 'AI Model Selector & Reasoning Engine', priority: 'high', tags: ['AI'], subtasksCompleted: 3, subtasksTotal: 3, assignee: { name: 'Dev Team' } },
      ],
    },
  ];

  // Mock Timeline items
  const mockTimelineItems: TimelineItem[] = [
    {
      id: 't-1',
      title: 'Workflow Execution Succeeded',
      description: 'Auto-categorized 450 inbound research documents and generated executive briefing.',
      timestamp: '2 mins ago',
      status: 'completed',
      duration: '1.4s',
      tags: ['Workflow', 'NLP'],
      actor: { name: 'Synthesis Bot' },
      details: '{"status": "ok", "documentsProcessed": 450, "tokens": 84200, "cost": "$0.12"}',
    },
    {
      id: 't-2',
      title: 'Agent Tool Invocation',
      description: 'Queried vector store and fetched top-5 contextual document chunks.',
      timestamp: '5 mins ago',
      status: 'completed',
      duration: '310ms',
      tags: ['RAG', 'Search'],
      actor: { name: 'Search Agent' },
    },
    {
      id: 't-3',
      title: 'Model Inference Started',
      description: 'Streaming structured reasoning chain with Claude 3.7 Sonnet.',
      timestamp: '8 mins ago',
      status: 'in_progress',
      duration: '720ms',
      tags: ['LLM', 'Streaming'],
      actor: { name: 'Claude 3.7' },
    },
  ];

  // Mock Tree data
  const mockTreeData: TreeNode[] = [
    {
      id: 'root-src',
      label: 'src',
      children: [
        {
          id: 'components',
          label: 'components',
          children: [
            { id: 'ui', label: 'ui', children: [{ id: 'button.tsx', label: 'button.tsx' }, { id: 'data-grid.tsx', label: 'data-grid.tsx' }] },
            { id: 'ai', label: 'ai', children: [{ id: 'ai-agent-card.tsx', label: 'ai-agent-card.tsx' }, { id: 'ai-model-selector.tsx', label: 'ai-model-selector.tsx' }] },
          ],
        },
        {
          id: 'tokens',
          label: 'tokens',
          children: [{ id: 'colors.ts', label: 'colors.ts' }, { id: 'typography.ts', label: 'typography.ts' }],
        },
      ],
    },
  ];

  // Mock Universal Card Config
  const sampleCardConfig: UniversalCardConfig = {
    id: 'uc-1',
    type: 'agent',
    variant: 'featured',
    density: 'default',
    title: 'Autonomous Research Assistant',
    subtitle: 'Claude 3.7 Sonnet • Hybrid Reasoning',
    description: 'Searches multi-source knowledge bases, cross-verifies citations, and generates verified markdown synthesis reports.',
    status: 'Active',
    statusType: 'success',
    tags: ['Research', 'Analysis', 'Web', 'PDF'],
    metadata: {
      speed: '480ms',
      runs: '12,450',
      success: '99.4%',
      quota: '1M tokens/mo',
    },
    actions: [
      { id: 'run', label: 'Run Agent', variant: 'primary', icon: <Play className="size-3" /> },
      { id: 'cfg', label: 'Configure', variant: 'outline', icon: <Settings className="size-3" /> },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Studio Control Bar */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface/90 backdrop-blur-md px-6 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs font-bold">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                Platform Design System Studio
              </h1>
              <Badge variant="secondary" className="font-mono text-[10px]">
                v2.0 • ReUI-Inspired
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Developer-First &amp; AI-Native Modular Component System
            </p>
          </div>
        </div>

        {/* Live Control Customizer Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Theme Mode Switcher */}
          <ButtonGroup attached>
            <Button
              size="xs"
              variant={theme === 'light' ? 'primary' : 'outline'}
              onClick={() => setTheme('light')}
              title="Light mode"
            >
              <Sun className="size-3" />
            </Button>
            <Button
              size="xs"
              variant={theme === 'dark' ? 'primary' : 'outline'}
              onClick={() => setTheme('dark')}
              title="Dark mode"
            >
              <Moon className="size-3" />
            </Button>
            <Button
              size="xs"
              variant={theme === 'system' ? 'primary' : 'outline'}
              onClick={() => setTheme('system')}
              title="System mode"
            >
              Auto
            </Button>
          </ButtonGroup>

          <Separator orientation="vertical" className="h-5" />

          {/* Density Switcher */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-subtle">Density:</span>
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
              className="h-7 rounded-btn border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              {DENSITIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Radius Switcher */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-subtle">Radius:</span>
            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value as RadiusPreset)}
              className="h-7 rounded-btn border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Accent Color Picker */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-subtle">Accent:</span>
            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value as Accent)}
              className="h-7 rounded-btn border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring capitalize"
            >
              {ACCENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-9 bg-surface-raised border border-border">
            <TabsTrigger value="foundations" className="text-xs gap-1.5">
              <Palette className="size-3.5" />
              Foundations
            </TabsTrigger>
            <TabsTrigger value="primitives" className="text-xs gap-1.5">
              <Sliders className="size-3.5" />
              Primitives
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs gap-1.5">
              <Layout className="size-3.5" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="ai-native" className="text-xs gap-1.5">
              <Sparkles className="size-3.5" />
              AI Layer
            </TabsTrigger>
            <TabsTrigger value="blocks-cards" className="text-xs gap-1.5">
              <Layers className="size-3.5" />
              Cards &amp; Blocks
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* 1. FOUNDATIONS */}
          {/* ========================================================================= */}
          <TabsContent value="foundations" className="space-y-8 pt-6">
            {/* Color Tokens Ramp */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Color System &amp; Palette Ramp</h2>
                  <p className="text-xs text-muted-foreground">
                    Theme-responsive tokens using semantic CSS variables with zero hard-coded colors.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { name: 'Primary (Brand)', token: '--primary', class: 'bg-primary text-primary-foreground' },
                  { name: 'Surface', token: '--surface', class: 'bg-surface border border-border text-foreground' },
                  { name: 'Surface Raised', token: '--surface-raised', class: 'bg-surface-raised text-foreground' },
                  { name: 'Accent / Hover', token: '--accent', class: 'bg-accent text-accent-foreground' },
                  { name: 'Selected State', token: '--selected', class: 'bg-selected text-primary-text' },
                  { name: 'Destructive', token: '--destructive', class: 'bg-destructive text-destructive-foreground' },
                  { name: 'Success (Forest)', token: '--success', class: 'bg-success text-success-foreground' },
                  { name: 'Warning (Amber)', token: '--warning', class: 'bg-warning text-warning-foreground' },
                  { name: 'Info (Manta Blue)', token: '--info', class: 'bg-info text-info-foreground' },
                  { name: 'Border Strong', token: '--border-strong', class: 'bg-border-strong text-foreground' },
                  { name: 'Sidebar Chrome', token: '--sidebar', class: 'bg-sidebar border border-sidebar-border text-sidebar-foreground' },
                  { name: 'Popover Surface', token: '--popover', class: 'bg-popover border border-border text-popover-foreground' },
                ].map((c) => (
                  <div
                    key={c.name}
                    onClick={() => copyToClipboard(`var(${c.token})`)}
                    className={cn(
                      'flex flex-col justify-between rounded-card p-3 h-24 shadow-xs cursor-pointer transition-transform hover:scale-102',
                      c.class,
                    )}
                  >
                    <span className="text-xs font-semibold">{c.name}</span>
                    <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                      <span>{c.token}</span>
                      {copiedToken === `var(${c.token})` ? <Check className="size-3" /> : <Copy className="size-3 opacity-60" />}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Categorical Accent System */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Categorical Accent System</h2>
              <p className="text-xs text-muted-foreground">
                Harmonized accents for chart series, badges, agent tags, and classification.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {ACCENTS.map((accName) => (
                  <div
                    key={accName}
                    onClick={() => copyToClipboard(`var(--accent-${accName})`)}
                    className="flex items-center justify-between rounded-card border border-border bg-surface p-3 shadow-xs cursor-pointer hover:border-border-strong"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-4 rounded-full border border-border/40"
                        style={{ backgroundColor: accName === 'mint' ? 'var(--primary)' : `var(--accent-${accName})` }}
                      />
                      <span className="text-xs font-medium capitalize text-foreground">{accName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-subtle">
                      {copiedToken === `var(--accent-${accName})` ? 'Copied!' : 'Copy'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Typography Hierarchy */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Typography Scale</h2>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs divide-y divide-border/60">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-2xl font-bold tracking-tight">Display — 32px Bold</span>
                  <span className="font-mono text-xs text-subtle">text-2xl font-bold</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xl font-bold tracking-tight">Heading 1 — 24px Bold</span>
                  <span className="font-mono text-xs text-subtle">text-xl font-bold</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-base font-semibold tracking-tight">Heading 2 — 16px Semibold</span>
                  <span className="font-mono text-xs text-subtle">text-base font-semibold</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-sm font-semibold">Heading 3 — 14px Semibold</span>
                  <span className="font-mono text-xs text-subtle">text-sm font-semibold</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs font-normal">Body Regular — 14px / 13px Neutral Ink</span>
                  <span className="font-mono text-xs text-subtle">text-xs</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs font-mono">Monospace Code — JetBrains Mono</span>
                  <span className="font-mono text-xs text-subtle">font-mono text-xs</span>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* ========================================================================= */}
          {/* 2. PRIMITIVES */}
          {/* ========================================================================= */}
          <TabsContent value="primitives" className="space-y-8 pt-6">
            {/* Buttons Showcase */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Buttons &amp; Button Groups</h2>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="subtle">Subtle</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link Button</Button>
                  <Button variant="primary" loading>Loading</Button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button size="xs" variant="primary">Size XS</Button>
                  <Button size="sm" variant="primary">Size SM</Button>
                  <Button size="md" variant="primary">Size MD (Default)</Button>
                  <Button size="lg" variant="primary">Size LG</Button>
                  <IconButton aria-label="Settings" icon={<Settings className="size-4" />} />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <ButtonGroup attached>
                    <Button variant="outline" size="sm">Day</Button>
                    <Button variant="outline" size="sm">Week</Button>
                    <Button variant="outline" size="sm">Month</Button>
                    <Button variant="outline" size="sm">Year</Button>
                  </ButtonGroup>

                  <ButtonGroup attached={false}>
                    <Button variant="secondary" size="sm">Action 1</Button>
                    <Button variant="secondary" size="sm">Action 2</Button>
                  </ButtonGroup>
                </div>
              </div>
            </section>

            {/* Inputs & Form Controls */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Form Controls &amp; Inputs</h2>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Standard Input</label>
                  <Input placeholder="Enter username..." />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Input with Icon</label>
                  <Input leadingIcon={<Search className="size-3.5" />} placeholder="Search agents..." />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Input Group</label>
                  <InputGroup prefixNode="https://" suffixNode=".onetab.ai">
                    <Input placeholder="workspace-slug" />
                  </InputGroup>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Combobox Multi-Select</label>
                  <Combobox
                    multiple
                    options={[
                      { value: 'gpt4', label: 'GPT-4o' },
                      { value: 'claude37', label: 'Claude 3.7' },
                      { value: 'gemini', label: 'Gemini 2.0' },
                      { value: 'deepseek', label: 'DeepSeek R1' },
                    ]}
                    defaultValue={['gpt4', 'claude37']}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Slider Range</label>
                  <Slider defaultValue={[45]} max={100} step={1} showTooltip />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Toggle Group</label>
                  <ToggleGroup type="single" defaultValue="grid">
                    <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
                    <ToggleGroupItem value="list">List</ToggleGroupItem>
                    <ToggleGroupItem value="table">Table</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Radio Group</label>
                  <RadioGroup defaultValue="opt-1">
                    <RadioGroupItem value="opt-1" label="Standard Speed" description="Best for normal chats" />
                    <RadioGroupItem value="opt-2" label="Deep Reasoning" description="Optimized for multi-step logic" />
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Switches &amp; Checkboxes</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch defaultChecked />
                      <span className="text-xs">Notifications</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox defaultChecked />
                      <span className="text-xs">Telemetry</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Context Menu Trigger</label>
                  <ContextMenu>
                    <ContextMenuTrigger className="flex h-12 w-full items-center justify-center rounded-btn border border-dashed border-border bg-surface-raised text-xs text-muted-foreground hover:text-foreground">
                      Right click here for Context Menu
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuLabel>Agent Actions</ContextMenuLabel>
                      <ContextMenuItem icon={<Play className="size-3.5" />} shortcut="⌘R">
                        Run Agent
                      </ContextMenuItem>
                      <ContextMenuItem icon={<Copy className="size-3.5" />} shortcut="⌘C">
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuCheckboxItem checked>Enable Logging</ContextMenuCheckboxItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem destructive shortcut="⌫">
                        Delete Agent
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </section>

            {/* Dropdown Menus & Selects */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Dropdown Menus &amp; Selects</h2>
              <p className="text-xs text-muted-foreground">
                One dropdown language across the app: the same surface, radius, row
                height, hover/focus/selected/disabled treatment in both themes.
                Toggle Light / Dark / System above to check every state.
              </p>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Full DropdownMenu — every item type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Dropdown Menu (all item types)</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        Actions
                        <ChevronDown className="size-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Record</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Pencil />
                        Edit
                        <DropdownMenuShortcut keys={['mod', 'E']} />
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <UserPlus />
                        Assign (disabled)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>View</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={menuAutosave}
                        onCheckedChange={(v) => setMenuAutosave(Boolean(v))}
                      >
                        Autosave
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuRadioGroup value={menuDensity} onValueChange={setMenuDensity}>
                        <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Archive />
                          Move to…
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>Project Atlas</DropdownMenuItem>
                          <DropdownMenuItem>Project Beacon</DropdownMenuItem>
                          <DropdownMenuItem>Project Cascade</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">
                        <Trash2 />
                        Delete
                        <DropdownMenuShortcut keys={['del']} />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* AppSelect — short list */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AppSelect — status (short list)</label>
                  <AppSelect
                    value={statusValue}
                    onValueChange={setStatusValue}
                    options={statusOptions}
                    placeholder="Select status"
                  />
                </div>

                {/* AppSelect — searchable */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AppSelect — assignee (searchable)</label>
                  <AppSelect
                    searchable
                    value={assigneeValue}
                    onValueChange={setAssigneeValue}
                    options={memberOptions}
                    placeholder="Select member"
                    searchPlaceholder="Search members…"
                    emptyText="No members found."
                  />
                </div>

                {/* AppSelect — loading */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AppSelect — loading</label>
                  <AppSelect loading options={[]} placeholder="Select project" />
                </div>

                {/* AppSelect — disabled */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AppSelect — disabled</label>
                  <AppSelect disabled options={statusOptions} placeholder="Select status" />
                </div>

                {/* AppSelect — empty */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AppSelect — empty</label>
                  <AppSelect options={[]} placeholder="Select label" emptyText="No labels yet." />
                </div>

                {/* Grouped Radix Select for parity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Select — grouped</label>
                  <Select defaultValue="claude37">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Anthropic</SelectLabel>
                        <SelectItem value="claude37">Claude 3.7 Sonnet</SelectItem>
                        <SelectItem value="claude-haiku">Claude Haiku 4.5</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>OpenAI</SelectLabel>
                        <SelectItem value="gpt4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt4o-mini">GPT-4o mini</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Accordions & Drawers */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Accordions &amp; Drawers</h2>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs space-y-4">
                <Accordion type="single" collapsible defaultValue="item-1">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>What makes this design system developer-first?</AccordionTrigger>
                    <AccordionContent>
                      It provides tokenized CSS variables, typed schema registries, copy-and-own architecture, accessible Radix primitives, and comprehensive AI execution traces.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>How does density switching work?</AccordionTrigger>
                    <AccordionContent>
                      The density engine sets a data-density attribute that dynamically recalibrates control heights, gaps, paddings, and font metrics across every view without layout shifts.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                    Open Slide-in Drawer
                  </Button>
                  <Drawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    title="Slide-in Detail Drawer"
                    description="Slide-in drawer overlay for responsive details, logs, and inspections."
                  >
                    <div className="space-y-3 text-xs">
                      <p className="text-muted-foreground">
                        Drawers support bottom, left, and right positions with smooth animations and keyboard escape traps.
                      </p>
                      <div className="rounded-md bg-surface-raised p-3 border border-border font-mono text-[11px]">
                        status: &quot;ready&quot;
                        <br />
                        execution_id: &quot;trace-948271&quot;
                      </div>
                    </div>
                    <DrawerFooter>
                      <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                        Close
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setDrawerOpen(false)}>
                        Save Changes
                      </Button>
                    </DrawerFooter>
                  </Drawer>
                </div>
              </div>
            </section>

            {/* ReUI / c-tabs-7 Styled Tabs Showcase */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Tabs &amp; Navigation (c-tabs-7 Experience)</h2>
              <p className="text-xs text-muted-foreground">
                Accessible Radix tabs supporting animated sliding indicators, counter badges, leading icons, horizontal overflow scrolling, and multiple visual variants.
              </p>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs space-y-6">
                {/* Variant: c-tabs-7 with icons and counts */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">c-tabs-7 Experience (Animated Active Indicator + Badges)</span>
                  <Tabs defaultValue="all">
                    <TabsList variant="c-tabs-7">
                      <TabsTrigger value="all" icon={<Layers className="size-3.5" />} count={24}>
                        All Items
                      </TabsTrigger>
                      <TabsTrigger value="active" icon={<Play className="size-3.5" />} count={8}>
                        Active
                      </TabsTrigger>
                      <TabsTrigger value="archived" icon={<Archive className="size-3.5" />} count={16}>
                        Archived
                      </TabsTrigger>
                      <TabsTrigger value="settings" icon={<Settings className="size-3.5" />}>
                        Settings
                      </TabsTrigger>
                      <TabsTrigger value="locked" disabled count={0}>
                        Disabled Tab
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="p-3 rounded-md bg-surface-raised border border-border text-xs text-muted-foreground">
                      Displaying all 24 items in unified view.
                    </TabsContent>
                    <TabsContent value="active" className="p-3 rounded-md bg-surface-raised border border-border text-xs text-muted-foreground">
                      Displaying 8 running agent workflows and background tasks.
                    </TabsContent>
                    <TabsContent value="archived" className="p-3 rounded-md bg-surface-raised border border-border text-xs text-muted-foreground">
                      Displaying 16 historical snapshots and preserved runs.
                    </TabsContent>
                    <TabsContent value="settings" className="p-3 rounded-md bg-surface-raised border border-border text-xs text-muted-foreground">
                      Tab-specific configuration and telemetry settings.
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Underline & Segmented variants */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground">Underline Navigation Strip</span>
                    <Tabs defaultValue="overview">
                      <TabsList variant="underline">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="analytics" count={3}>Analytics</TabsTrigger>
                        <TabsTrigger value="audit">Audit Log</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground">Segmented Control Variant</span>
                    <Tabs defaultValue="day">
                      <TabsList variant="segmented">
                        <TabsTrigger value="day">Day</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                        <TabsTrigger value="month">Month</TabsTrigger>
                        <TabsTrigger value="year">Year</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </div>
            </section>

            {/* Contextual Hover Cards Showcase */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Contextual Hover Cards</h2>
              <p className="text-xs text-muted-foreground">
                Lightweight popover previews for users, projects, kanban cards, and channels with calibrated open/close delays (300ms/150ms) to eliminate flickering.
              </p>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* User Hover Card */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">User Context Card</span>
                  <div>
                    <UserHoverCard
                      user={{
                        name: 'Ada Lovelace',
                        email: 'ada@onetab.ai',
                        role: 'Principal Engineer',
                        status: 'online',
                        bio: 'Working on autonomous reasoning workflows and agent tooling.',
                        timezone: 'London (UTC+1)',
                      }}
                    >
                      <button className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer">
                        @ada.lovelace
                      </button>
                    </UserHoverCard>
                  </div>
                </div>

                {/* Project Hover Card */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">Project Context Card</span>
                  <div>
                    <ProjectHoverCard
                      project={{
                        name: 'Apollo Matrix Hub',
                        identifier: 'APO-2026',
                        description: 'Real-time Matrix federation and E2EE communication bridge.',
                        status: 'In Development',
                        membersCount: 14,
                        updatedAt: '20 mins ago',
                      }}
                    >
                      <button className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer">
                        Project Apollo
                      </button>
                    </ProjectHoverCard>
                  </div>
                </div>

                {/* Kanban Card Hover Card */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">Kanban Card Preview</span>
                  <div>
                    <KanbanCardHoverCard
                      card={{
                        title: 'Optimize Radix Popover viewport flipping',
                        identifier: 'TSK-408',
                        status: 'in progress',
                        priority: 'high',
                        assignee: 'Antigravity',
                        dueDate: 'Tomorrow',
                      }}
                    >
                      <button className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer">
                        TASK-408
                      </button>
                    </KanbanCardHoverCard>
                  </div>
                </div>

                {/* Channel Hover Card */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">Channel Context Card</span>
                  <div>
                    <ChannelHoverCard
                      channel={{
                        name: 'engineering-general',
                        description: 'Cross-functional discussions, platform releases, and CI alerts.',
                        isPrivate: false,
                        membersCount: 52,
                      }}
                    >
                      <button className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer">
                        #engineering-general
                      </button>
                    </ChannelHoverCard>
                  </div>
                </div>
              </div>
            </section>

            {/* Keyboard Shortcuts & Kbd Showcase */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Kbd &amp; Keyboard Shortcuts</h2>
              <p className="text-xs text-muted-foreground">
                Platform-aware keyboard glyphs (⌘ on macOS, Ctrl on Windows/Linux), standardized sizes, and design token borders.
              </p>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Command Palette:</span>
                    <KbdShortcut keys={['mod', 'K']} size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Quick Action:</span>
                    <KbdShortcut shortcut="mod+shift+p" size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sequential:</span>
                    <KbdShortcut shortcut="G then U" size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Escape:</span>
                    <KbdShortcut keys={['esc']} size="sm" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Sizes:</span>
                  <Kbd size="xs">XS</Kbd>
                  <Kbd size="sm">SM</Kbd>
                  <Kbd size="md">MD</Kbd>
                  <Kbd size="lg">LG</Kbd>
                  <span className="text-xs text-muted-foreground ml-4">Variants:</span>
                  <Kbd variant="default">Default</Kbd>
                  <Kbd variant="outline">Outline</Kbd>
                  <Kbd variant="muted">Muted</Kbd>
                  <Kbd variant="elevated">Elevated</Kbd>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* ========================================================================= */}
          {/* 3. ADVANCED REUSABLE COMPONENTS */}
          {/* ========================================================================= */}
          <TabsContent value="advanced" className="space-y-8 pt-6">
            {/* Live Data Grid */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Interactive Developer Data Grid</h2>
              <p className="text-xs text-muted-foreground">
                Features multi-column sorting, column filtering, search, column visibility toggle, bulk actions, and pagination.
              </p>
              <DataGrid<UserAgentRecord>
                title="Agent Fleet Inventory"
                data={mockDataGridRecords}
                columns={dataGridColumns}
                enableSelection
                enableColumnVisibility
                enableExport
                bulkActions={[
                  {
                    id: 'run-ai',
                    label: 'Batch Run',
                    icon: <Play className="size-3" />,
                    onClick: (rows: UserAgentRecord[]) => alert(`Running ${rows.length} agents`),
                  },
                ]}
              />
            </section>

            {/* Kanban Board */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Modular Kanban Board</h2>
              <KanbanBoard columns={mockKanbanCols} />
            </section>

            {/* Timeline & Tree View */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-foreground">Interactive Timeline</h2>
                <Timeline items={mockTimelineItems} />
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-foreground">Hierarchical Tree Explorer</h2>
                <TreeView data={mockTreeData} defaultExpandedIds={['root-src', 'components']} />
              </div>
            </section>

            {/* Filter Builder & Resizable Panels */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Visual Query Filter Builder</h2>
              <FilterBuilder
                fields={[
                  { id: 'name', label: 'Agent Name', type: 'text' },
                  { id: 'model', label: 'AI Model', type: 'select', options: [{ value: 'gpt4', label: 'GPT-4o' }, { value: 'claude', label: 'Claude 3.7' }] },
                  { id: 'executions', label: 'Execution Count', type: 'number' },
                ]}
                onApply={(rules: any) => console.log('Applied rules:', rules)}
              />
            </section>

          </TabsContent>

          {/* ========================================================================= */}
          {/* 4. AI-NATIVE DESIGN LAYER */}
          {/* ========================================================================= */}
          <TabsContent value="ai-native" className="space-y-8 pt-6">
            {/* Model Selector & Thinking State */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">AI Model Selector &amp; Thinking State</h2>
              <div className="rounded-card border border-border bg-surface p-4 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-foreground">Active Model:</span>
                  <AIModelSelector value="claude-3-7-sonnet" />
                </div>

                <AIThinkingState
                  title="Chain of Thought Reasoning"
                  thinkingText={`1. Retrieved 8 knowledge base documents regarding monorepo build caches.\n2. Analyzed Nx affected dependency graph across 62 workspace projects.\n3. Verified token ramp contrast ratios (Mint #60c686 vs Deep Forest #11271f >= 4.5:1).\n4. Formulating step-by-step trace output...`}
                  durationSeconds={3}
                />
              </div>
            </section>

            {/* AI Agent Cards */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">AI Agent Cards (Variants)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AIAgentCard
                  id="ag-1"
                  name="Research Agent"
                  description="Finds information, cross-references sources, and generates executive research briefs."
                  model="Claude 3.7 Sonnet"
                  status="online"
                  variant="featured"
                  tools={['Search', 'Files', 'VectorDB']}
                  capabilities={['Citations', 'Reasoning']}
                  runsCount={1420}
                  avgLatency="420ms"
                  onRun={() => alert('Running Research Agent')}
                />

                <AIAgentCard
                  id="ag-2"
                  name="Code Reviewer"
                  description="Automated pull request code reviewer with security audit and style rule enforcement."
                  model="GPT-4o"
                  status="running"
                  variant="card"
                  tools={['GitHub API', 'AST Parser']}
                  capabilities={['Lint', 'Refactor']}
                  runsCount={8930}
                  avgLatency="310ms"
                />

                <AIAgentCard
                  id="ag-3"
                  name="Data Analyst"
                  description="Runs SQL aggregations and renders dynamic charts and metric summaries."
                  model="DeepSeek R1"
                  status="idle"
                  variant="card"
                  tools={['Postgres', 'ClickHouse']}
                  capabilities={['SQL', 'Charts']}
                  runsCount={540}
                  avgLatency="820ms"
                />
              </div>
            </section>

            {/* AI Execution Trace & Citations & Usage */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-foreground">Execution Trace Timeline</h2>
                <AIExecutionTimeline
                  totalDurationMs={1420}
                  totalTokens={1240}
                  steps={[
                    { id: 's-1', name: 'Request Received', type: 'queued', status: 'completed', durationMs: 12 },
                    { id: 's-2', name: 'Execution Plan Formulation', type: 'planning', status: 'completed', durationMs: 180, tokensUsed: 120 },
                    { id: 's-3', name: 'Query Vector Knowledge Base', type: 'search', status: 'completed', durationMs: 420, toolName: 'pgvector', inputPayload: { query: 'design tokens' }, outputPayload: { matches: 5 } },
                    { id: 's-4', name: 'Generate Structured UI Output', type: 'generating', status: 'completed', durationMs: 808, tokensUsed: 1120 },
                  ]}
                />
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-foreground">Citations &amp; Sources Viewer</h2>
                  <div className="rounded-card border border-border bg-surface p-4 shadow-xs">
                    <AICitationViewer
                      citations={[
                        { id: 'c-1', title: 'Platform Architecture Whitepaper', sourceName: 'architecture.pdf', snippet: 'The platform design system enforces 5 visual layers starting from foundational CSS custom properties.', relevanceScore: 0.96 },
                        { id: 'c-2', title: 'ReUI Component Reference Docs', sourceName: 'reui.dev/docs', url: 'https://reui.dev', snippet: 'Components follow a copy-and-own philosophy and provide real-world patterns.', relevanceScore: 0.91 },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-base font-bold text-foreground">AI Quota &amp; Usage Widget</h2>
                  <AIUsageWidget
                    usedTokens={684000}
                    maxTokens={1000000}
                    usedCredits={34.5}
                    totalCredits={50.0}
                    onUpgrade={() => alert('Opening Upgrade modal')}
                  />
                </div>
              </div>
            </section>
          </TabsContent>

          {/* ========================================================================= */}
          {/* 5. CARDS & BLOCK REGISTRY */}
          {/* ========================================================================= */}
          <TabsContent value="blocks-cards" className="space-y-8 pt-6">
            {/* Universal Card Sandbox */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Universal Dynamic Card Sandbox</h2>
              <p className="text-xs text-muted-foreground">
                JSON-driven universal card renderer capable of rendering 16+ card types across Dashboards, Chat, and Feeds.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <UniversalCard config={sampleCardConfig} />
                <UniversalCard
                  config={{
                    id: 'uc-2',
                    type: 'workflow',
                    title: 'Automated CI/CD Pipeline',
                    subtitle: 'GitHub Action Trigger',
                    description: 'Runs linting, unit tests, and builds docker containers upon PR merge.',
                    status: 'Active',
                    statusType: 'info',
                    tags: ['CI/CD', 'Docker', 'Nx'],
                    metadata: { trigger: 'git push', lastRun: '12m ago' },
                    actions: [{ id: 'trigger', label: 'Trigger Now', variant: 'outline' }],
                  }}
                />
                <UniversalCard
                  config={{
                    id: 'uc-3',
                    type: 'metric',
                    title: 'Monthly Token Consumption',
                    subtitle: 'All AI Providers',
                    status: '+18.4% MoM',
                    statusType: 'success',
                    metadata: { tokens: '4.2M', cost: '$84.20', p95_latency: '340ms' },
                    actions: [{ id: 'view-analytics', label: 'View Breakdown', variant: 'secondary' }],
                  }}
                />
              </div>
            </section>

            {/* Modular Page Blocks */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-foreground">Modular Page Blocks System</h2>
              <p className="text-xs text-muted-foreground">
                JSON-configurable page blocks for composition in Dashboards, Landing pages, and Apps.
              </p>

              {/* Hero Block */}
              <BlockRenderer
                block={{
                  id: 'blk-hero',
                  type: 'hero',
                  badge: 'Platform Design System 2.0',
                  title: 'Build AI-Native Applications with World-Class Speed',
                  description: 'A developer-first design framework combining ReUI modularity, Linear UX precision, and AI execution primitives.',
                  actions: [
                    { label: 'Explore Components', variant: 'primary' },
                    { label: 'View Documentation', variant: 'outline' },
                  ],
                }}
              />

              {/* Stats Block */}
              <BlockRenderer
                block={{
                  id: 'blk-stats',
                  type: 'stats',
                  data: {
                    items: [
                      { label: 'Active AI Agents', value: '48', trend: 'up', trendLabel: '+12% this week', description: 'Autonomous workers' },
                      { label: 'Avg Execution Latency', value: '310ms', trend: 'down', trendLabel: '-18ms faster', description: 'Fast inference' },
                      { label: 'Workflow Automations', value: '142', trend: 'up', trendLabel: '+24 new', description: 'Scheduled pipelines' },
                      { label: 'Tokens Processed', value: '18.4M', trend: 'up', trendLabel: '+3.2M', description: 'Across all providers' },
                    ],
                  },
                }}
              />

              {/* Features Block */}
              <BlockRenderer
                block={{
                  id: 'blk-features',
                  type: 'features',
                  badge: 'Core Primitives',
                  title: 'Engineered for Developers & AI Agents',
                  description: 'Every component conforms to tokenized styling, high-contrast accessibility, and explicit JSON schemas.',
                  data: {
                    features: [
                      { title: 'Zero Hard-Coded Colors', description: 'Theme switching operates on CSS variables across Light, Dark, and System modes.' },
                      { title: 'Dynamic Density Engine', description: 'Switch between Compact, Default, and Comfortable modes on the fly.' },
                      { title: 'AI-Native Transparency', description: 'Rich chain-of-thought traces, citations inspection, and token metering out of the box.' },
                    ],
                  },
                }}
              />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
