import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, emailTemplatesApi, queryKeys } from '@org/api-client';
import type {
  AdminEmailDelivery,
  EmailDeliveryStatus,
  EmailTemplateDefinition,
  EmailTemplateCategory,
  RenderedTemplateResult,
} from '@org/types';
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  CodeInput,
  confirm,
  toast,
} from '@org/ui';
import { formatDateTime, formatRelative } from '@org/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  XCircle,
  Smartphone,
  Monitor,
  Send,
  Edit3,
  RotateCcw,
  Server,
  Layers,
  ShieldCheck,
} from 'lucide-react';

const ALL_VALUES = 'all';

const CATEGORY_NAMES: Record<string, string> = {
  AUTHENTICATION: 'Authentication',
  WORKSPACE: 'Workspace',
  TEAM: 'Team & Collab',
  PROJECTS: 'Projects',
  TASKS: 'Tasks',
  DOCS: 'Documents',
  MESSAGING: 'Messaging & Inbox',
  MEETINGS: 'Meetings',
  AI_AGENTS: 'AI Agents',
  HIRE: 'Hiring & ATS',
  VOICE: 'Voice & Calls',
  BILLING: 'Billing & Plans',
  SECURITY: 'Security & Access',
  SYSTEM: 'System & Platform',
};

function getCategoryBadge(category: EmailTemplateCategory | string) {
  const cat = String(category).toUpperCase();
  const name = CATEGORY_NAMES[cat] || cat;
  let colorCls = 'bg-slate-500/15 text-slate-400 border-slate-500/25';

  if (cat === 'AUTHENTICATION')
    colorCls = 'bg-blue-500/15 text-blue-400 border-blue-500/25';
  else if (cat === 'WORKSPACE')
    colorCls = 'bg-violet-500/15 text-violet-400 border-violet-500/25';
  else if (cat === 'TEAM')
    colorCls = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25';
  else if (cat === 'PROJECTS')
    colorCls = 'bg-sky-500/15 text-sky-400 border-sky-500/25';
  else if (cat === 'TASKS')
    colorCls = 'bg-amber-500/15 text-amber-400 border-amber-500/25';
  else if (cat === 'DOCS')
    colorCls = 'bg-accent-green-soft text-accent-green border-accent-green/25';
  else if (cat === 'MESSAGING')
    colorCls = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25';
  else if (cat === 'MEETINGS')
    colorCls = 'bg-purple-500/15 text-purple-400 border-purple-500/25';
  else if (cat === 'AI_AGENTS')
    colorCls = 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25';
  else if (cat === 'HIRE')
    colorCls = 'bg-pink-500/15 text-pink-400 border-pink-500/25';
  else if (cat === 'VOICE')
    colorCls = 'bg-rose-500/15 text-rose-400 border-rose-500/25';
  else if (cat === 'BILLING')
    colorCls = 'bg-teal-500/15 text-teal-400 border-teal-500/25';
  else if (cat === 'SECURITY')
    colorCls = 'bg-red-500/15 text-red-400 border-red-500/25';

  return (
    <span
      className={`px-2 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase ${colorCls}`}
    >
      {name}
    </span>
  );
}

function getStatusBadge(status: EmailDeliveryStatus) {
  switch (status) {
    case 'DELIVERED':
      return (
        <span className="gap-1 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border border-success/25 bg-success/15 text-[10px] text-success-text uppercase">
          <CheckCircle2 className="size-3" />
          DELIVERED
        </span>
      );
    case 'SENT':
      return (
        <span className="gap-1 border-blue-500/25 bg-blue-500/15 text-blue-400 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase">
          <CheckCircle2 className="size-3" />
          SENT
        </span>
      );
    case 'OPENED':
      return (
        <span className="gap-1 border-teal-500/25 bg-teal-500/15 text-teal-400 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase">
          <Eye className="size-3" />
          OPENED
        </span>
      );
    case 'CLICKED':
      return (
        <span className="gap-1 border-cyan-500/25 bg-cyan-500/15 text-cyan-400 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase">
          <MousePointerClick className="size-3" />
          CLICKED
        </span>
      );
    case 'FAILED':
    case 'BOUNCED':
    case 'COMPLAINED':
      return (
        <span className="gap-1 border-rose-500/25 bg-rose-500/15 text-rose-400 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase">
          <XCircle className="size-3" />
          {status}
        </span>
      );
    case 'QUEUED':
    case 'SENDING':
      return (
        <span className="gap-1 border-amber-500/25 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border text-[10px] uppercase">
          <Clock className="size-3" />
          {status}
        </span>
      );
    default:
      return (
        <span className="gap-1 px-2.5 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full border border-border/80 bg-muted/60 text-[10px] text-muted-foreground uppercase">
          {status}
        </span>
      );
  }
}

export function EmailDeliveriesView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'templates' | 'providers' | 'deliveries'
  >('templates');

  // --- Templates State ---
  const [templateCategory, setTemplateCategory] = useState<string>(ALL_VALUES);
  const [templateStatus, setTemplateStatus] = useState<string>(ALL_VALUES);
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [previewTemplate, setPreviewTemplate] =
    useState<EmailTemplateDefinition | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [previewTab, setPreviewTab] = useState<'html' | 'schema'>('html');
  const [renderedPreview, setRenderedPreview] =
    useState<RenderedTemplateResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Edit Template State
  const [editingTemplate, setEditingTemplate] =
    useState<EmailTemplateDefinition | null>(null);
  const [editSubject, setEditSubject] = useState<string>('');
  const [editHtml, setEditHtml] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');

  // Test Email State
  const [testingTemplate, setTestingTemplate] =
    useState<EmailTemplateDefinition | null>(null);
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [testStatusMessage, setTestStatusMessage] = useState<string | null>(
    null,
  );
  const [isTestSending, setIsTestSending] = useState<boolean>(false);

  // --- Delivery Logs State ---
  const [statusFilter, setStatusFilter] = useState(ALL_VALUES);
  const [typeFilter, setTypeFilter] = useState(ALL_VALUES);
  const [recipientFilter, setRecipientFilter] = useState('');
  const [debouncedRecipient, setDebouncedRecipient] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<AdminEmailDelivery | null>(
    null,
  );

  // --- Queries ---
  const {
    data: templates = [],
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
    refetch: refetchTemplates,
    isFetching: isTemplatesFetching,
  } = useQuery({
    queryKey: queryKeys.emailTemplates.list({
      category: templateCategory === ALL_VALUES ? undefined : templateCategory,
      status: templateStatus === ALL_VALUES ? undefined : templateStatus,
      search: templateSearch.trim() || undefined,
    }),
    queryFn: () =>
      emailTemplatesApi.list({
        category:
          templateCategory === ALL_VALUES ? undefined : templateCategory,
        status: templateStatus === ALL_VALUES ? undefined : templateStatus,
        search: templateSearch.trim() || undefined,
      }),
  });

  const {
    data: providersData,
    refetch: refetchProviders,
    isFetching: isProvidersFetching,
  } = useQuery({
    queryKey: queryKeys.emailTemplates.providers(),
    queryFn: () => emailTemplatesApi.providers(),
    enabled: activeTab === 'providers',
  });

  const { data: eventsData } = useQuery({
    queryKey: queryKeys.emailTemplates.events(),
    queryFn: () => emailTemplatesApi.events(),
    enabled: activeTab === 'providers',
  });

  const deliveryQueryParams = {
    status: statusFilter === ALL_VALUES ? undefined : statusFilter,
    type: typeFilter === ALL_VALUES ? undefined : typeFilter,
    recipient: debouncedRecipient.trim() || undefined,
    page,
    pageSize: 25,
  };

  const {
    data: deliveriesData,
    isLoading: isDeliveriesLoading,
    isError: isDeliveriesError,
    refetch: refetchDeliveries,
    isFetching: isDeliveriesFetching,
  } = useQuery({
    queryKey: queryKeys.admin.emails(deliveryQueryParams),
    queryFn: () => adminApi.emails(deliveryQueryParams),
    refetchInterval: activeTab === 'deliveries' ? 15_000 : false,
    enabled: activeTab === 'deliveries',
  });

  const emails: AdminEmailDelivery[] = deliveriesData?.items ?? [];
  const total = deliveriesData?.total ?? 0;
  const pageSize = deliveriesData?.pageSize ?? 25;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  // --- Load Preview when Preview Modal opens ---
  useEffect(() => {
    if (!previewTemplate) {
      setRenderedPreview(null);
      return;
    }
    let isCancelled = false;
    setIsPreviewLoading(true);

    emailTemplatesApi
      .preview(previewTemplate.templateKey, {
        customSubject: previewTemplate.subject,
        customHtml: previewTemplate.htmlBody,
      })
      .then((res: RenderedTemplateResult) => {
        if (!isCancelled) setRenderedPreview(res);
      })
      .catch((err: unknown) => {
        console.error('Failed to preview template:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsPreviewLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [previewTemplate]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (vars: {
      key: string;
      data: Partial<EmailTemplateDefinition>;
    }) => emailTemplatesApi.update(vars.key, vars.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates.all(),
      });
      setEditingTemplate(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (key: string) => emailTemplatesApi.reset(key),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates.all(),
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (provider: string) =>
      emailTemplatesApi.verifyProvider(provider),
    onSuccess: (res) => {
      if (res.verified) toast.success(`${res.name}: ${res.message}`);
      else toast.error(`${res.name}: ${res.message}`);
    },
  });

  const handleReset = async (tpl: EmailTemplateDefinition) => {
    const ok = await confirm({
      title: `Reset “${tpl.name}”?`,
      description:
        'The custom override is deleted and the system default is used again.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (ok) resetMutation.mutate(tpl.templateKey);
  };

  const handleOpenEdit = (t: EmailTemplateDefinition) => {
    setEditingTemplate(t);
    setEditSubject(t.subject);
    setEditHtml(t.htmlBody);
    setEditStatus(t.status || 'ACTIVE');
  };

  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      key: editingTemplate.templateKey,
      data: {
        subject: editSubject,
        htmlBody: editHtml,
        status: editStatus as EmailTemplateDefinition['status'],
      },
    });
  };

  const handleSendTest = async () => {
    if (!testingTemplate || !testRecipient.trim()) return;
    setIsTestSending(true);
    setTestStatusMessage(null);
    try {
      const res = await emailTemplatesApi.test(testingTemplate.templateKey, {
        recipient: testRecipient.trim(),
      });
      if (res.delivered) {
        setTestStatusMessage(
          `Success! Test email sent via ${res.transport || 'active provider'}. Message ID: ${res.id || 'ok'}`,
        );
      } else {
        setTestStatusMessage(
          `Failed to send test email: ${res.error || 'Unknown error'}`,
        );
      }
    } catch (err: unknown) {
      setTestStatusMessage(
        `Error: ${err instanceof Error ? err.message : 'Dispatch failed'}`,
      );
    } finally {
      setIsTestSending(false);
    }
  };

  const handleRecipientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedRecipient(recipientFilter);
    setPage(1);
  };

  return (
    <Page>
      <PageHeader
        title="Transactional Email Center"
        description="Enterprise transactional email template registry, provider telemetry, template previews, and delivery logs."
        icon={<Mail />}
        accent="blue"
        actions={
          <div className="gap-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'templates') refetchTemplates();
                else if (activeTab === 'providers') refetchProviders();
                else refetchDeliveries();
              }}
              disabled={
                isTemplatesFetching ||
                isDeliveriesFetching ||
                isProvidersFetching
              }
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${
                  isTemplatesFetching ||
                  isDeliveriesFetching ||
                  isProvidersFetching
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="w-full"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="templates" className="gap-2">
              <Layers className="size-4" />
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="providers" className="gap-2">
              <Server className="size-4" />
              Providers & Infrastructure
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-2">
              <Mail className="size-4" />
              Delivery Logs ({total})
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: TEMPLATES REGISTRY                                                 */}
          {/* ========================================================================= */}
          <TabsContent value="templates" className="space-y-4">
            {/* Filter Toolbar */}
            <div className="shadow-2xs overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="lg:flex-row lg:items-center gap-3 p-4 sm:px-5 sm:py-3.5 flex flex-col justify-between border-b border-border/40">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                    Centralized Template Catalog
                  </h3>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Production transactional email definitions across 14 product
                    categories
                  </p>
                </div>

                <div className="gap-2.5 flex flex-wrap items-center">
                  <div className="w-64 relative">
                    <Input
                      type="text"
                      placeholder="Search key, name, subject…"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs rounded-full border border-border/60 bg-background/50 text-foreground transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-1"
                    />
                    <Search className="size-3.5 left-2.5 pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>

                  <Select
                    value={templateCategory}
                    onValueChange={(val) => setTemplateCategory(val)}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs px-3 rounded-full border border-border/60 bg-background/50">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUES}>
                        All Categories (14)
                      </SelectItem>
                      <SelectItem value="AUTHENTICATION">
                        Authentication
                      </SelectItem>
                      <SelectItem value="WORKSPACE">Workspace</SelectItem>
                      <SelectItem value="TEAM">Team & Collab</SelectItem>
                      <SelectItem value="PROJECTS">Projects</SelectItem>
                      <SelectItem value="TASKS">Tasks</SelectItem>
                      <SelectItem value="DOCS">Documents</SelectItem>
                      <SelectItem value="MESSAGING">
                        Messaging & Inbox
                      </SelectItem>
                      <SelectItem value="MEETINGS">Meetings</SelectItem>
                      <SelectItem value="AI_AGENTS">AI Agents</SelectItem>
                      <SelectItem value="HIRE">Hiring & ATS</SelectItem>
                      <SelectItem value="VOICE">Voice & Calls</SelectItem>
                      <SelectItem value="BILLING">Billing & Plans</SelectItem>
                      <SelectItem value="SECURITY">
                        Security & Access
                      </SelectItem>
                      <SelectItem value="SYSTEM">System & Platform</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={templateStatus}
                    onValueChange={(val) => setTemplateStatus(val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs px-3 rounded-full border border-border/60 bg-background/50">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUES}>All Status</SelectItem>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                      <SelectItem value="DRAFT">DRAFT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Templates Table */}
              {isTemplatesLoading ? (
                <div className="py-12">
                  <LoadingState label="Loading templates catalog…" />
                </div>
              ) : isTemplatesError ? (
                <div className="p-6">
                  <ErrorState
                    title="Could not load templates"
                    description="Failed to load transactional email templates from registry."
                  />
                </div>
              ) : templates.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Mail />}
                    title="No templates found"
                    description="No email templates match the current filter criteria."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/40 hover:bg-transparent">
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Template Name & Key
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Category
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Subject Line
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Status
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Origin
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90">
                          Version
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold text-right text-muted-foreground/90">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((tpl: EmailTemplateDefinition) => (
                        <TableRow
                          key={tpl.templateKey}
                          className="border-b border-border/40 transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="py-3.5 px-5">
                            <div className="font-medium text-xs text-foreground">
                              {tpl.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {tpl.templateKey}
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 px-5">
                            {getCategoryBadge(tpl.category)}
                          </TableCell>
                          <TableCell
                            className="py-3.5 px-5 text-xs max-w-xs truncate text-muted-foreground"
                            title={tpl.subject}
                          >
                            {tpl.subject}
                          </TableCell>
                          <TableCell className="py-3.5 px-5">
                            <span
                              className={`px-2 py-0.5 font-semibold tracking-wider inline-flex items-center rounded-full text-[10px] uppercase ${
                                tpl.status === 'ACTIVE'
                                  ? 'border border-success/25 bg-success/15 text-success-text'
                                  : 'border border-border bg-muted text-muted-foreground'
                              }`}
                            >
                              {tpl.status || 'ACTIVE'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-5">
                            {tpl.isSystemTemplate ? (
                              <span className="border-blue-500/25 bg-blue-500/10 text-blue-400 px-2 py-0.5 font-medium inline-flex items-center rounded-full border text-[10px]">
                                System Default
                              </span>
                            ) : (
                              <span className="border-purple-500/25 bg-purple-500/10 text-purple-400 px-2 py-0.5 font-medium inline-flex items-center rounded-full border text-[10px]">
                                Custom Override
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 px-5 font-mono text-[11px] text-muted-foreground">
                            v{tpl.version || 1}
                          </TableCell>
                          <TableCell className="py-3.5 px-5 text-right">
                            <div className="gap-1.5 flex items-center justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 rounded-lg border border-border/60 hover:bg-muted/50"
                                onClick={() => setPreviewTemplate(tpl)}
                                title="Live Preview"
                              >
                                <Eye className="size-3.5" />
                                Preview
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 rounded-lg border border-border/60 hover:bg-muted/50"
                                onClick={() => {
                                  setTestingTemplate(tpl);
                                  setTestRecipient('');
                                  setTestStatusMessage(null);
                                }}
                                title="Send Test Email"
                              >
                                <Send className="size-3.5" />
                                Test
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 rounded-lg border border-border/60 hover:bg-muted/50"
                                onClick={() => handleOpenEdit(tpl)}
                                title="Customize Template"
                              >
                                <Edit3 className="size-3.5" />
                                Edit
                              </Button>
                              {!tpl.isSystemTemplate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 rounded-lg border border-border/60 text-destructive hover:bg-muted/50"
                                  onClick={() => void handleReset(tpl)}
                                  title="Reset to System Default"
                                >
                                  <RotateCcw className="size-3.5" />
                                  Reset
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: PROVIDERS & INFRASTRUCTURE                                         */}
          {/* ========================================================================= */}
          <TabsContent value="providers" className="space-y-4">
            <div className="md:grid-cols-3 gap-4 grid grid-cols-1">
              <div className="p-5 shadow-2xs space-y-2 rounded-2xl border border-border/60 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Primary Provider
                  </span>
                  <Server className="size-4 text-primary" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground capitalize">
                  {providersData?.primary ?? '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {providersData?.primary === 'log'
                    ? 'Log transport: mail is printed to the API log, not delivered'
                    : 'Default delivery transport for transactional dispatches'}
                </p>
              </div>

              <div className="p-5 shadow-2xs space-y-2 rounded-2xl border border-border/60 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Fallback Chain
                  </span>
                  <Layers className="size-4 text-amber-400" />
                </div>
                <div className="text-sm font-mono text-foreground">
                  {providersData?.fallback?.length
                    ? providersData.fallback.join(' → ')
                    : 'None configured'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tried in order when the primary provider errors
                </p>
              </div>

              <div className="p-5 shadow-2xs space-y-2 rounded-2xl border border-border/60 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Delivery Queue
                  </span>
                  <ShieldCheck className="size-4 text-success-text" />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {providersData
                    ? `${providersData.queue.pendingCount} pending · ${providersData.queue.deadLetterCount} failed`
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  In-process retries with exponential backoff (memory only)
                </p>
              </div>
            </div>

            {/* Providers Roster */}
            <div className="shadow-2xs overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
                <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                  Provider Drivers
                </h3>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Selected with MAIL_TRANSPORT / MAIL_PROVIDER; credentials come
                  from the API environment
                </p>
              </div>

              <div className="p-5 md:grid-cols-2 gap-4 grid grid-cols-1">
                {(providersData?.providers ?? []).map((p) => {
                  const isPrimary = p.provider === providersData?.primary;
                  return (
                    <div
                      key={p.provider}
                      className="p-4 space-y-3 rounded-xl border border-border/60 bg-background/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="gap-2 flex items-center">
                          <div
                            className={`size-2.5 rounded-full ${
                              p.ready ? 'bg-success' : 'bg-muted-foreground'
                            }`}
                          />
                          <span className="font-semibold text-sm capitalize">
                            {p.provider}
                          </span>
                          {isPrimary && (
                            <span className="font-mono text-[10px] text-primary uppercase">
                              primary
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase ${
                            p.ready
                              ? 'border-success/25 bg-success/15 text-success-text'
                              : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.ready ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        From <span className="font-mono">{p.defaultFrom}</span>
                        {p.error ? ` · ${p.error}` : ''}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(p.provider)}
                      >
                        Verify connection
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Event Bus Subscriptions */}
            <div className="shadow-2xs overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
                <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                  Domain Event Bus Email Routing
                </h3>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Platform events mapped to transactional templates via
                  EmailEventRegistry
                </p>
              </div>
              <div className="p-5 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/40">
                      <TableHead className="text-xs font-semibold">
                        Event Name
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Associated Template Key
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Description
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(eventsData || []).map((ev: any) => (
                      <TableRow
                        key={ev.eventName}
                        className="text-xs border-b border-border/40"
                      >
                        <TableCell className="font-medium font-mono text-foreground">
                          {ev.eventName}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold font-mono text-primary">
                            {ev.templateKey}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ev.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: DELIVERIES (EXISTING LOGS)                                          */}
          {/* ========================================================================= */}
          <TabsContent value="deliveries" className="space-y-4">
            <div className="shadow-2xs overflow-hidden rounded-2xl border border-border/60 bg-card">
              {/* Header Toolbar */}
              <div className="lg:flex-row lg:items-center gap-3 p-4 sm:px-5 sm:py-3.5 flex flex-col justify-between border-b border-border/40">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                    Transactional Deliveries
                  </h3>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Delivery logs, recipient states, and provider telemetry
                  </p>
                </div>

                <div className="gap-2.5 flex flex-wrap items-center">
                  <form
                    onSubmit={handleRecipientSubmit}
                    className="w-64 relative"
                  >
                    <Input
                      type="text"
                      placeholder="Search recipient email…"
                      value={recipientFilter}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs rounded-full border border-border/60 bg-background/50 text-foreground transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-1"
                    />
                    <Search className="size-3.5 left-2.5 pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </form>

                  <Select
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      className="h-8 w-36 text-xs px-3 rounded-full border border-border/60 bg-background/50"
                      aria-label="Filter by status"
                    >
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUES}>All Statuses</SelectItem>
                      <SelectItem value="SENT">SENT</SelectItem>
                      <SelectItem value="DELIVERED">DELIVERED</SelectItem>
                      <SelectItem value="OPENED">OPENED</SelectItem>
                      <SelectItem value="CLICKED">CLICKED</SelectItem>
                      <SelectItem value="FAILED">FAILED</SelectItem>
                      <SelectItem value="BOUNCED">BOUNCED</SelectItem>
                      <SelectItem value="COMPLAINED">COMPLAINED</SelectItem>
                      <SelectItem value="QUEUED">QUEUED</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={typeFilter}
                    onValueChange={(val) => {
                      setTypeFilter(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      className="h-8 w-44 text-xs px-3 rounded-full border border-border/60 bg-background/50"
                      aria-label="Filter by email type"
                    >
                      <SelectValue placeholder="All Email Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUES}>
                        All Email Types
                      </SelectItem>
                      <SelectItem value="AUTH_OTP">Auth OTP</SelectItem>
                      <SelectItem value="AUTH_WELCOME">Welcome</SelectItem>
                      <SelectItem value="AUTH_PASSWORD_RESET">
                        Password Reset
                      </SelectItem>
                      <SelectItem value="WORKSPACE_INVITATION">
                        Workspace Invitation
                      </SelectItem>
                      <SelectItem value="TASK_ASSIGNED">
                        Task Assigned
                      </SelectItem>
                      <SelectItem value="AGENT_APPROVAL_REQUIRED">
                        Agent Approval
                      </SelectItem>
                      <SelectItem value="MEETING_INVITATION">
                        Meeting Invitation
                      </SelectItem>
                      <SelectItem value="BILLING_PAYMENT_FAILED">
                        Billing Payment Failed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table / State */}
              {isDeliveriesLoading ? (
                <div className="py-12">
                  <LoadingState label="Loading email delivery records…" />
                </div>
              ) : isDeliveriesError ? (
                <div className="p-6">
                  <ErrorState
                    title="Could not load email delivery logs"
                    description="Failed to fetch transactional email deliveries. Verify the API service is accessible and you have SUPERADMIN privileges."
                  />
                </div>
              ) : emails.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Mail />}
                    title="No transactional email deliveries found"
                    description={
                      statusFilter !== ALL_VALUES ||
                      typeFilter !== ALL_VALUES ||
                      debouncedRecipient
                        ? 'No email records match the selected filters.'
                        : 'Transactional emails sent via Resend or log transport will be displayed here.'
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/40 hover:bg-transparent">
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Status
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Recipient
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Type
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Workspace
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Provider
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-muted-foreground/90">
                          Created
                        </TableHead>
                        <TableHead className="py-3 px-5 text-xs font-semibold tracking-tight text-right text-muted-foreground/90">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emails.map((email) => (
                        <TableRow
                          key={email.id}
                          className="cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell className="py-3.5 px-5">
                            {getStatusBadge(email.status)}
                          </TableCell>
                          <TableCell className="py-3.5 px-5 text-xs font-medium font-mono text-foreground">
                            {email.recipient}
                          </TableCell>
                          <TableCell className="py-3.5 px-5">
                            <span className="px-2.5 py-0.5 inline-flex items-center rounded-full border border-border/80 bg-muted/60 font-mono text-[10px] text-foreground uppercase">
                              {email.type}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-5 text-xs text-muted-foreground">
                            {email.workspace?.name ?? '— (System)'}
                          </TableCell>
                          <TableCell className="py-3.5 px-5 text-xs font-mono text-muted-foreground">
                            <span className="font-medium text-foreground capitalize">
                              {email.provider}
                            </span>
                            {email.providerMessageId && (
                              <span className="block text-[10px] opacity-75">
                                {email.providerMessageId}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className="py-3.5 px-5 text-xs text-muted-foreground"
                            title={formatDateTime(email.createdAt)}
                          >
                            {formatRelative(email.createdAt)}
                          </TableCell>
                          <TableCell className="py-3.5 px-5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2.5 rounded-lg border border-border/60 hover:bg-muted/50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(email);
                              }}
                            >
                              Inspect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              <div className="px-5 py-3 text-xs flex items-center justify-between border-t border-border/40 text-muted-foreground">
                <span>
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {total === 0 ? 0 : (page - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-foreground">
                    {Math.min(page * pageSize, total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-foreground">{total}</span>{' '}
                  entries
                </span>
                <div className="gap-2 flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="size-7 flex items-center justify-center rounded-lg border border-border/60 bg-background/50 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="px-1 font-medium text-foreground">
                    Page {page} of {Math.max(1, lastPage)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(lastPage, current + 1))
                    }
                    disabled={page >= lastPage}
                    aria-label="Next page"
                    className="size-7 flex items-center justify-center rounded-lg border border-border/60 bg-background/50 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ========================================================================= */}
      {/* PREVIEW MODAL (Desktop / Mobile Sandbox)                                  */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      >
        <DialogContent className="max-w-4xl flex max-h-[90vh] flex-col">
          <DialogHeader>
            <div className="pr-6 flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="gap-2 text-base font-semibold flex items-center">
                  <Mail className="size-4 text-primary" />
                  {previewTemplate?.name}
                </DialogTitle>
                <div className="text-xs font-mono text-muted-foreground">
                  Key: {previewTemplate?.templateKey}
                </div>
              </div>
              <div className="gap-2 flex items-center">
                <div className="p-0.5 flex items-center rounded-lg border border-border/80 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={`px-2 py-1 text-xs gap-1.5 flex items-center rounded-md transition-colors ${
                      previewMode === 'desktop'
                        ? 'shadow-2xs font-medium bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Monitor className="size-3.5" />
                    Desktop (600px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={`px-2 py-1 text-xs gap-1.5 flex items-center rounded-md transition-colors ${
                      previewMode === 'mobile'
                        ? 'shadow-2xs font-medium bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Smartphone className="size-3.5" />
                    Mobile (375px)
                  </button>
                </div>

                <div className="p-0.5 flex items-center rounded-lg border border-border/80 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('html')}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      previewTab === 'html'
                        ? 'shadow-2xs font-medium bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('schema')}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      previewTab === 'schema'
                        ? 'shadow-2xs font-medium bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Variables (
                    {previewTemplate?.variablesSchema?.variables?.length || 0})
                  </button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-3 flex-1 overflow-y-auto">
            {previewTab === 'html' ? (
              <div className="space-y-3">
                {/* Subject & Preview Text header */}
                <div className="p-3 text-xs space-y-1 rounded-xl border border-border/60 bg-muted/40">
                  <div className="gap-2 flex items-center">
                    <span className="font-semibold text-muted-foreground">
                      Subject:
                    </span>
                    <span className="font-medium text-foreground">
                      {renderedPreview?.subject || previewTemplate?.subject}
                    </span>
                  </div>
                  {previewTemplate?.previewText && (
                    <div className="gap-2 flex items-center">
                      <span className="font-semibold text-muted-foreground">
                        Preheader:
                      </span>
                      <span className="text-muted-foreground">
                        {renderedPreview?.previewText ||
                          previewTemplate.previewText}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sandboxed Email Container */}
                <div className="bg-slate-900/50 p-4 flex min-h-[450px] items-center justify-center rounded-xl border border-border/60">
                  {isPreviewLoading ? (
                    <LoadingState label="Rendering template preview…" />
                  ) : renderedPreview?.html ? (
                    <div
                      className={`bg-white overflow-hidden rounded-xl shadow-lg transition-all duration-200 ${
                        previewMode === 'mobile'
                          ? 'h-[550px] w-[375px]'
                          : 'h-[550px] w-[620px]'
                      }`}
                    >
                      <iframe
                        title="Email Preview"
                        srcDoc={renderedPreview.html}
                        className="h-full w-full border-0"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Variables Schema Inspector */
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-sm mb-1 text-foreground">
                    Available Template Variables
                  </h4>
                  <p className="text-muted-foreground">
                    Interpolated safely at render time using Handlebars syntax.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/40">
                        <TableHead className="text-xs">
                          Variable Token
                        </TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs">Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewTemplate?.variablesSchema?.variables?.map(
                        (v: any) => (
                          <TableRow
                            key={v.name}
                            className="border-b border-border/40"
                          >
                            <TableCell className="font-semibold font-mono text-primary">
                              &#123;&#123;{v.name}&#125;&#125;
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {v.type}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {v.description}
                            </TableCell>
                            <TableCell>
                              {v.required ? (
                                <span className="font-medium text-destructive">
                                  Yes
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Optional
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>

                {previewTemplate?.variablesSchema?.samplePayload && (
                  <div className="space-y-1.5">
                    <span className="font-semibold block text-foreground">
                      Mock Sample Payload (JSON)
                    </span>
                    <pre className="p-3 overflow-x-auto rounded-xl bg-muted/60 font-mono text-[11px] text-foreground">
                      {JSON.stringify(
                        previewTemplate.variablesSchema.samplePayload,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* TEST EMAIL MODAL                                                          */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(testingTemplate)}
        onOpenChange={(open) => {
          if (!open) setTestingTemplate(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="gap-2 text-base flex items-center">
              <Send className="size-4 text-primary" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            <p className="text-muted-foreground">
              Dispatches a live test email rendered with sample payload tokens
              to verify formatting and deliverability.
            </p>

            <div className="space-y-1">
              <label className="font-semibold block text-foreground">
                Template
              </label>
              <div className="text-xs p-2 rounded-lg border border-border/60 bg-muted/50 font-mono">
                {testingTemplate?.templateKey} ({testingTemplate?.name})
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold block text-foreground">
                Recipient Email Address
              </label>
              <Input
                type="email"
                placeholder="developer@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {testStatusMessage && (
              <div
                className={`p-3 text-xs rounded-lg border ${
                  testStatusMessage.startsWith('Success')
                    ? 'border-success/30 bg-success/10 text-success-text'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {testStatusMessage}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSendTest}
              disabled={isTestSending || !testRecipient.trim()}
              className="gap-1.5"
            >
              {isTestSending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT TEMPLATE MODAL                                                       */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(editingTemplate)}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null);
        }}
      >
        <DialogContent className="max-w-2xl flex max-h-[85vh] flex-col">
          <DialogHeader>
            <DialogTitle className="gap-2 text-base flex items-center">
              <Edit3 className="size-4 text-amber-400" />
              Customize Template: {editingTemplate?.name}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs flex-1 overflow-y-auto">
            <div className="space-y-1">
              <label className="font-semibold block text-foreground">
                Subject Line
              </label>
              <Input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold block text-foreground">
                Status
              </label>
              <Select
                value={editStatus}
                onValueChange={(val) => setEditStatus(val)}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold block text-foreground">
                  HTML Body Content
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Supports &#123;&#123;variable&#125;&#125; and &#123;#if&#125;
                  conditionals
                </span>
              </div>
              <CodeInput
                language="html"
                minRows={14}
                maxRows={24}
                value={editHtml}
                onChange={setEditHtml}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DELIVERY DETAILS DIALOG                                                   */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(selectedEmail)}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="gap-2 flex items-center">
              <Mail className="size-4 text-primary" />
              Delivery Details
            </DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <DialogBody className="space-y-4 text-xs">
              <div className="pb-3 flex items-center justify-between border-b">
                <span className="text-muted-foreground">Current Status</span>
                <div>{getStatusBadge(selectedEmail.status)}</div>
              </div>

              <div className="gap-3 pb-3 grid grid-cols-2 border-b">
                <div>
                  <span className="mb-0.5 block text-muted-foreground">
                    Recipient
                  </span>
                  <span className="font-medium font-mono">
                    {selectedEmail.recipient}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-muted-foreground">
                    Template Type
                  </span>
                  <span className="font-medium font-mono">
                    {selectedEmail.type}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-muted-foreground">
                    Provider
                  </span>
                  <span className="font-medium capitalize">
                    {selectedEmail.provider}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-muted-foreground">
                    Provider ID
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {selectedEmail.providerMessageId ?? 'None'}
                  </span>
                </div>
              </div>

              {selectedEmail.errorMessage && (
                <div className="rounded p-3 space-y-1 border border-destructive/20 bg-destructive/10 text-destructive">
                  <div className="gap-1.5 font-medium flex items-center">
                    <AlertCircle className="size-3.5" />
                    <span>
                      Error Code: {selectedEmail.errorCode ?? 'UNKNOWN'}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] whitespace-pre-wrap">
                    {selectedEmail.errorMessage}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pb-3 border-b">
                <span className="font-medium mb-1 block text-foreground">
                  Telemetry Timeline
                </span>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-mono text-foreground">
                      {formatDateTime(selectedEmail.createdAt)}
                    </span>
                  </div>
                  {selectedEmail.sentAt && (
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="font-mono text-foreground">
                        {formatDateTime(selectedEmail.sentAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.deliveredAt && (
                    <div className="flex justify-between text-success-text">
                      <span>Delivered:</span>
                      <span className="font-medium font-mono">
                        {formatDateTime(selectedEmail.deliveredAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.openedAt && (
                    <div className="text-teal-400 flex justify-between">
                      <span>Opened:</span>
                      <span className="font-medium font-mono">
                        {formatDateTime(selectedEmail.openedAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.clickedAt && (
                    <div className="text-cyan-400 flex justify-between">
                      <span>Clicked:</span>
                      <span className="font-medium font-mono">
                        {formatDateTime(selectedEmail.clickedAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.bouncedAt && (
                    <div className="text-rose-400 flex justify-between">
                      <span>Bounced:</span>
                      <span className="font-medium font-mono">
                        {formatDateTime(selectedEmail.bouncedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="font-mono text-[10px] text-muted-foreground">
                Delivery ID: {selectedEmail.id}
              </div>
            </DialogBody>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

export default EmailDeliveriesView;
